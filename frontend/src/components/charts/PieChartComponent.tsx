import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'

const COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
]

interface Props {
  data: { name: string; value: number }[]
  height?: number
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
          innerRadius={35}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `${fmt.format(value)} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
            name,
          ]}
        />
        <Legend
          formatter={(value) =>
            value.length > 20 ? `${value.substring(0, 20)}...` : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
