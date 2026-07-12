import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface LineConfig {
  key: string
  name: string
  color: string
  yAxisId?: 'left' | 'right'
}

interface Props {
  data: any[]
  lines: LineConfig[]
  xKey: string
  dualAxis?: boolean
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

export default function LineChartComponent({ data, lines, xKey, dualAxis = false, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: dualAxis ? 40 : 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#475569' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => fmt.format(v)} />
        {dualAxis && (
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => fmt.format(v)} />
        )}
        <Tooltip formatter={(v: number) => fmt.format(v)} contentStyle={tooltipStyle} />
        <Legend />
        {lines.map(line => (
          <Line
            key={line.key}
            yAxisId={line.yAxisId ?? 'left'}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
