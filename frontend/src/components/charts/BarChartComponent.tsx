import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface BarConfig {
  key: string
  name: string
  color: string
}

interface Props {
  data: any[]
  xKey: string
  bars: BarConfig[]
  horizontal?: boolean
  height?: number
}

const fmt = Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderRadius: '8px',
  color: '#061a3a',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

export default function BarChartComponent({ data, xKey, bars, horizontal = false, height = 300 }: Props) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, data.length * 28 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 130, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => fmt.format(v)} />
          <YAxis dataKey={xKey} type="category" tick={{ fontSize: 10, fill: '#475569' }} width={125} />
          <Tooltip formatter={(v: number) => fmt.format(v)} contentStyle={tooltipStyle} />
          <Legend />
          {bars.map(b => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[0, 4, 4, 0]} maxBarSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 35 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#475569', angle: -30, textAnchor: 'end' }} />
        <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => fmt.format(v)} />
        <Tooltip formatter={(v: number) => fmt.format(v)} contentStyle={tooltipStyle} />
        <Legend />
        {bars.map(b => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
