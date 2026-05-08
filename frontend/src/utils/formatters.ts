export function formatCOP(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n) || n === 0) return '$0'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)} B`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)} MM`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)} M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)} K`
  return `$${Math.round(n).toLocaleString('es-CO')}`
}

export function formatBytes(value: number | string): string {
  const n = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(n) || n === 0) return '0 B'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

export function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(n)) return '0'
  return n.toLocaleString('es-CO')
}

export function formatDate(value: string): string {
  if (!value) return '-'
  return value.split('T')[0]
}
