import { spawn } from 'bun'

console.log('Starting SECOP Dashboard in development mode...\n')

const api = spawn({
  cmd: ['bun', '--watch', 'src/index.ts'],
  cwd: import.meta.dir + '/api',
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, PORT: '3001' },
})

const frontend = spawn({
  cmd: ['bun', 'run', 'dev'],
  cwd: import.meta.dir + '/frontend',
  stdout: 'inherit',
  stderr: 'inherit',
})

console.log('  API      → http://localhost:3001')
console.log('  Frontend → http://localhost:5173\n')

process.on('SIGINT', () => {
  api.kill()
  frontend.kill()
  process.exit(0)
})

await Promise.all([api.exited, frontend.exited])
