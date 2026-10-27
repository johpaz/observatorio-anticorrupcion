"""
Isolation Forest anomaly detector for SECOP II contractors.
Usage: python3 anomaly_scorer.py [sector]
Reads from anticorrup.db (must run from project root), writes anomaly_scores table.
"""
import sys
import json
import sqlite3
import os

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

DB_PATH = os.environ.get('DB_PATH', 'anticorrup.db')
sector = sys.argv[1] if len(sys.argv) > 1 else 'Transporte'
# Con pocos contratistas el escalado y el bosque son inestables: el resultado depende
# más de quién cayó en el lote que de su comportamiento.
MIN_NITS = 10
# Contratos "virtuales" que se suman al denominador de las tasas (suavizado hacia 0)
SMOOTHING = 5

con = sqlite3.connect(DB_PATH)

# Ensure anomaly_scores table exists
con.execute('''
    CREATE TABLE IF NOT EXISTS anomaly_scores (
        nit           TEXT PRIMARY KEY,
        sector        TEXT,
        anomaly_score REAL,
        features      TEXT,
        calculado_at  INTEGER DEFAULT (CAST(strftime('%s','now') AS INTEGER))
    )
''')
con.commit()

# Load NITs scored for this sector
nits_df = pd.read_sql(
    "SELECT nit FROM scores WHERE sector = ?", con, params=[sector]
)
if nits_df.empty:
    print(f"[ML] Sin NITs para sector={sector}")
    con.close()
    sys.exit(0)

# Build feature matrix — one row per NIT
def extract_features(nit: str, con) -> dict | None:
    rows = pd.read_sql(
        "SELECT entidad, valor, estado, fecha_fin, raw_json FROM contratos_cache WHERE nit = ?",
        con, params=[nit]
    )
    if rows.empty:
        return None

    dias_list: list[int] = []
    pct_baja_count = 0
    for _, r in rows.iterrows():
        try:
            raw = json.loads(r['raw_json'])
            dias = int(raw.get('dias_adicionados') or 0)
            dias_list.append(dias)

            valor = float(raw.get('valor_del_contrato') or 0)
            facturado = float(raw.get('valor_facturado') or 0)
            estado_raw = str(raw.get('estado_contrato') or '').lower()
            # Misma definición que BAJA_EJECUCION en scorer.ts: terminado o cancelado
            if valor > 5_000_000 and (facturado / valor) < 0.5 and ('terminado' in estado_raw or 'cancelado' in estado_raw):
                pct_baja_count += 1
        except Exception:
            pass

    now = pd.Timestamp.now()
    six_months_ago = now - pd.DateOffset(months=6)
    vencidos = 0
    for _, r in rows.iterrows():
        if not r['fecha_fin']:
            continue
        try:
            fecha = pd.to_datetime(r['fecha_fin'])
            estado = str(r['estado'] or '').lower()
            # Misma definición que VENCIDOS_SIN_CERRAR en scorer.ts: en ejecución o prorrogado
            if fecha < six_months_ago and ('ejecuci' in estado or 'prorrogado' in estado):
                vencidos += 1
        except Exception:
            pass

    total = max(len(rows), 1)
    valores = rows['valor'].dropna()

    # El modelo juzga conducta, no tamaño. Volumen de contratos, número de entidades y
    # valor máximo se dejaron fuera: en pruebas controladas marcaban como "anómalos" a
    # contratistas sanos solo por tener muy pocos o muchísimos contratos.
    # Las tasas se suavizan con SMOOTHING: un contratista con 3 contratos y 1 vencido no
    # debe pesar igual que uno con 300 y 100 vencidos. El valor medio por contrato va en
    # log1p porque los montos son muy asimétricos.
    return {
        'nit':                   nit,
        'pct_vencidos':          vencidos / (total + SMOOTHING),
        'pct_baja_ejecucion':    pct_baja_count / (total + SMOOTHING),
        'pct_con_adiciones':     sum(1 for d in dias_list if d > 0) / (total + SMOOTHING),
        'log_max_dias_adic':     float(np.log1p(max(dias_list))) if dias_list else 0.0,
        'log_avg_valor':         float(np.log1p(valores.mean())) if not valores.empty else 0.0,
    }

feature_rows = [extract_features(nit, con) for nit in nits_df['nit']]
feature_rows = [f for f in feature_rows if f is not None]

if len(feature_rows) < MIN_NITS:
    print(f"[ML] Insuficientes NITs ({len(feature_rows)} < {MIN_NITS}). Omitiendo.")
    con.close()
    sys.exit(0)

df = pd.DataFrame(feature_rows)
nits = df['nit'].tolist()
X = df.drop(columns=['nit']).fillna(0)

# Normalize + fit Isolation Forest
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# contamination="auto" fija el umbral en el valor teórico del algoritmo. Con un
# porcentaje fijo (antes 0.15) el modelo marcaba siempre ~15% de cada sector como
# outlier, aunque todos los contratistas fueran normales.
model = IsolationForest(
    n_estimators=200,
    contamination="auto",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_scaled)

# decision_function: negativo = más anómalo. Con contamination="auto" el 0 es el umbral teórico.
raw_scores = model.decision_function(X_scaled)

# Un detector no supervisado marca ambas colas de la distribución. Ser anómalo por tener
# MENOS vencidos, adiciones o baja ejecución que el resto del sector no es un riesgo, así
# que solo cuenta como anomalía quien además está por encima del promedio del grupo en las
# variables de conducta. Las demás conservan su score pero nunca bajan de 0.
RISK_COLS = [i for i, c in enumerate(X.columns) if c in ('pct_vencidos', 'pct_baja_ejecucion', 'pct_con_adiciones', 'log_max_dias_adic')]
direction = X_scaled[:, RISK_COLS].mean(axis=1)
raw_scores = np.where((raw_scores < 0) & (direction <= 0), 0.0, raw_scores)

# Write back to SQLite
cur = con.cursor()
for nit, score, feat in zip(nits, raw_scores, feature_rows):
    cur.execute(
        '''INSERT OR REPLACE INTO anomaly_scores
             (nit, sector, anomaly_score, features, calculado_at)
           VALUES (?, ?, ?, ?, CAST(strftime('%s','now') AS INTEGER))''',
        (nit, sector, float(score), json.dumps(feat))
    )
con.commit()
con.close()

threshold = -0.05
outliers = sum(1 for s in raw_scores if s < threshold)
print(f"[ML] IsolationForest: {len(feature_rows)} NITs · {outliers} outliers · sector={sector} · threshold={threshold}")
