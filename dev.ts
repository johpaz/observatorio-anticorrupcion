import { spawn } from 'bun'
import { existsSync } from 'fs'

console.log('Starting Observatorio Anticorrupción de Colombia in development mode...\n')

// Isolation Forest usa el venv local si existe (ver README: sección Tests)
const venvPython = import.meta.dir + '/.venv/bin/python3'
const PYTHON_BIN = process.env.PYTHON_BIN ?? (existsSync(venvPython) ? venvPython : 'python3')

const procuraduria = spawn({
  cmd: ['bun', 'run', '--watch', 'src/index.ts'],
  cwd: import.meta.dir + '/APi Procuraduria, multas, sanciones y obras inconclusas',
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, PORT: '3000' },
})

const api = spawn({
  cmd: ['bun', '--watch', 'src/index.ts'],
  cwd: import.meta.dir + '/api',
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, PORT: '3001', PROCURADURIA_URL: 'http://localhost:3000', PYTHON_BIN },
})

const frontend = spawn({
  cmd: ['bun', 'run', 'dev'],
  cwd: import.meta.dir + '/frontend',
  stdout: 'inherit',
  stderr: 'inherit',
})

console.log('  Procuraduria → http://localhost:3000')
console.log('  API          → http://localhost:3001')
console.log('  Frontend     → http://localhost:5173\n')

process.on('SIGINT', () => {
  procuraduria.kill()
  api.kill()
  frontend.kill()
  process.exit(0)
})

await Promise.all([procuraduria.exited, api.exited, frontend.exited])
