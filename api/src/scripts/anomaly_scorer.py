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
MIN_NITS = 5

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
            if valor > 5_000_000 and valor > 0 and (facturado / valor) < 0.5 and 'terminado' in estado_raw:
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
            if fecha < six_months_ago and 'ejecuci' in estado:
                vencidos += 1
        except Exception:
            pass

    total = max(len(rows), 1)
    valores = rows['valor'].dropna()

    return {
        'nit':                   nit,
        'total_contratos':       total,
        'num_entidades':         rows['entidad'].nunique(),
        'avg_valor':             float(valores.mean()) if not valores.empty else 0.0,
        'max_valor':             float(valores.max()) if not valores.empty else 0.0,
        'valor_total':           float(valores.sum()) if not valores.empty else 0.0,
        'pct_vencidos':          vencidos / total,
        'avg_dias_adicionados':  float(np.mean(dias_list)) if dias_list else 0.0,
        'max_dias_adicionados':  float(max(dias_list)) if dias_list else 0.0,
        'pct_baja_ejecucion':    pct_baja_count / total,
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

model = IsolationForest(
    n_estimators=100,
    contamination=0.15,   # ~15% del grupo son outliers
    random_state=42,
    n_jobs=-1,
)
model.fit(X_scaled)

# decision_function: negativo = más anómalo (rango aprox. -0.5 a +0.5)
raw_scores = model.decision_function(X_scaled)

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
