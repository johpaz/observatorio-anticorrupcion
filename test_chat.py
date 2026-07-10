"""
Test de integración: Chat Gemini 3 Flash ↔ SQLite anticorrup.db
Verifica que cada tool retorna datos reales de la base de datos.
"""
import json, sqlite3, urllib.request, sys

API = 'http://localhost:3001/api/chat'
DB  = 'anticorrup.db'

PASS = '\033[92m✓\033[0m'
FAIL = '\033[91m✗\033[0m'
INFO = '\033[94m·\033[0m'

def chat(msg: str) -> dict:
    req = urllib.request.Request(
        API,
        data=json.dumps({'message': msg}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def db_query(sql: str, *params):
    con = sqlite3.connect(DB)
    rows = con.execute(sql, params).fetchall()
    con.close()
    return rows

errors = 0

def ok(label: str, cond: bool, detail: str = ''):
    global errors
    icon = PASS if cond else FAIL
    print(f'  {icon} {label}' + (f'  [{detail}]' if detail else ''))
    if not cond:
        errors += 1

print('\n── Test 1: GEMINI_API_KEY activo ──────────────────────────')
d = chat('hola')
ok('responde sin error', 'error' not in d)
ok('tiene campo answer', bool(d.get('answer')))
no_key = 'API key de Gemini' in d.get('answer', '')
ok('API key cargada (no fallback)', not no_key, d.get('answer','')[:60])

print('\n── Test 2: obtener_score_riesgo ────────────────────────────')
# Toma un NIT real de la BD
real_nit = db_query('SELECT nit, nombre, score_total, nivel_riesgo FROM scores LIMIT 1')[0]
nit, nombre, score_db, nivel_db = real_nit
print(f'  {INFO} NIT en BD: {nit} | score={score_db} | nivel={nivel_db}')

d = chat(f'Dame el score de riesgo del NIT {nit}')
tools_used = [tc['tool'] for tc in d.get('tool_calls', [])]
ok('usó herramienta obtener_score_riesgo', 'obtener_score_riesgo' in tools_used)

tool_result = next((tc['result'] for tc in d.get('tool_calls', []) if tc['tool'] == 'obtener_score_riesgo'), {})
ok('resultado tiene nit correcto', tool_result.get('nit') == nit, f"got {tool_result.get('nit')}")
ok('score coincide con BD', tool_result.get('score_total') == score_db, f"BD={score_db} tool={tool_result.get('score_total')}")
ok('nivel coincide con BD', tool_result.get('nivel_riesgo') == nivel_db, f"BD={nivel_db} tool={tool_result.get('nivel_riesgo')}")
ok('respuesta menciona el NIT', nit in d.get('answer', ''), d.get('answer','')[:80])

print('\n── Test 3: buscar_contratista ──────────────────────────────')
# Toma un nombre real y busca por prefijo
real_nombre = db_query("SELECT nombre FROM scores WHERE nombre != 'Desconocido' LIMIT 1")[0][0]
termino = real_nombre.split()[0]  # primera palabra
print(f'  {INFO} Buscando: "{termino}" (de nombre real: {real_nombre[:40]})')

d = chat(f'Busca contratistas que se llamen "{termino}"')
tools_used = [tc['tool'] for tc in d.get('tool_calls', [])]
ok('usó herramienta buscar_contratista', 'buscar_contratista' in tools_used)

tool_result = next((tc['result'] for tc in d.get('tool_calls', []) if tc['tool'] == 'buscar_contratista'), [])
ok('retornó resultados', isinstance(tool_result, list) and len(tool_result) > 0, f"got {type(tool_result).__name__} len={len(tool_result) if isinstance(tool_result, list) else '?'}")
if isinstance(tool_result, list) and tool_result:
    first = tool_result[0]
    ok('resultados tienen nit y nombre', 'nit' in first and 'nombre' in first)
    # Verificar que el primer resultado existe en la BD
    db_check = db_query('SELECT 1 FROM scores WHERE nit = ?', first['nit'])
    ok('primer resultado existe en BD', len(db_check) > 0, f"nit={first['nit']}")

print('\n── Test 4: alertas_sector ──────────────────────────────────')
# Toma un sector real
real_sector = db_query("SELECT sector FROM scores WHERE sector IS NOT NULL GROUP BY sector ORDER BY COUNT(*) DESC LIMIT 1")[0][0]
print(f'  {INFO} Sector con más NITs en BD: {real_sector}')

d = chat(f'¿Cuáles son los contratistas ROJO en el sector {real_sector}?')
tools_used = [tc['tool'] for tc in d.get('tool_calls', [])]
ok('usó herramienta alertas_sector', 'alertas_sector' in tools_used)

tool_result = next((tc['result'] for tc in d.get('tool_calls', []) if tc['tool'] == 'alertas_sector'), [])
ok('retornó lista', isinstance(tool_result, list), f"got {type(tool_result).__name__}")

if isinstance(tool_result, list) and tool_result:
    # Verificar que los scores coinciden con la BD
    first = tool_result[0]
    db_score = db_query('SELECT score_total FROM scores WHERE nit = ?', first['nit'])
    if db_score:
        ok('score del primer resultado coincide con BD',
           db_score[0][0] == first.get('score_total'),
           f"BD={db_score[0][0]} tool={first.get('score_total')}")
    ok('todos son nivel ROJO', all(r.get('nivel_riesgo') == 'ROJO' for r in tool_result),
       f"niveles={list(set(r.get('nivel_riesgo') for r in tool_result))}")

print('\n── Test 5: FTS5 desde tool (LIKE fallback) ─────────────────')
d = chat('Lista contratistas cuyo nombre contenga la palabra municipio')
tools_used = [tc['tool'] for tc in d.get('tool_calls', [])]
ok('usó alguna tool de búsqueda', bool(tools_used), f"tools={tools_used}")
tool_result = next((tc['result'] for tc in d.get('tool_calls', []) if 'buscar' in tc['tool'] or 'alertas' in tc['tool']), [])
if isinstance(tool_result, list):
    ok('encontró resultados', len(tool_result) > 0)

print('\n── Resumen ─────────────────────────────────────────────────')
total_tests = 18  # approx
if errors == 0:
    print(f'  {PASS} Todos los tests pasaron\n')
else:
    print(f'  {FAIL} {errors} test(s) fallaron\n')

sys.exit(errors)
