/**
 * Logger mínimo estructurado: nivel + timestamp ISO + scope.
 * Nivel mínimo configurable con LOG_LEVEL (debug|info|warn|error), default info.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN = LEVELS[(Bun.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  if (LEVELS[level] < MIN) return
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  extra === undefined ? out(line) : out(line, extra)
}

export interface Logger {
  debug: (msg: string, extra?: unknown) => void
  info: (msg: string, extra?: unknown) => void
  warn: (msg: string, extra?: unknown) => void
  error: (msg: string, extra?: unknown) => void
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, extra) => emit('debug', scope, msg, extra),
    info: (msg, extra) => emit('info', scope, msg, extra),
    warn: (msg, extra) => emit('warn', scope, msg, extra),
    error: (msg, extra) => emit('error', scope, msg, extra),
  }
}
