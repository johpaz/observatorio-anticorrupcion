import { spawn } from 'bun'

console.log('Starting SECOP Dashboard in development mode...\n')

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
  env: { ...process.env, PORT: '3001', PROCURADURIA_URL: 'http://localhost:3000' },
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
