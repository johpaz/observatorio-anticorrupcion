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

export default function LineChartComponent({ data, lines, xKey, dualAxis = false, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 5, right: dualAxis ? 40 : 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => fmt.format(v)} />
        {dualAxis && (
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => fmt.format(v)} />
        )}
        <Tooltip formatter={(v: number) => fmt.format(v)} />
        <Legend />
        {lines.map(line => (
          <Line
            key={line.key}
            yAxisId={line.yAxisId ?? 'left'}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
