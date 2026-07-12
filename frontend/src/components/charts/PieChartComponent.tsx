import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'

const COLORS = [
  '#6366f1', '#eab308', '#10b981', '#f43f5e', '#3b82f6',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
]

interface Props {
  data: { name: string; value: number }[]
  height?: number
}

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderRadius: '8px',
  color: '#061a3a',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

export default function PieChartComponent({ data, height = 300 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const fmt = Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          outerRadius={85}
          innerRadius={45}
          dataKey="value"
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#ffffff" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `${fmt.format(value)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
            name,
          ]}
          contentStyle={tooltipStyle}
        />
        <Legend
          formatter={(value) =>
            value.length > 20 ? `${value.substring(0, 20)}...` : value
          }
          tick={{ fill: '#475569' }}
          wrapperStyle={{ color: '#475569' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
