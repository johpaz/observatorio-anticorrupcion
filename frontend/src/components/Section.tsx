import { ReactNode } from 'react'

interface Props {
  title: string
  kicker?: string
  tools?: ReactNode
  children: ReactNode
}

export default function Section({ title, kicker, tools, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          {kicker && <div className="smcaps" style={{ marginBottom: 4 }}>{kicker}</div>}
          <h2
            className="serif"
            style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: -0.2, color: 'var(--ink)', lineHeight: 1.2 }}
          >
            {title}
          </h2>
        </div>
        {tools && <div style={{ flexShrink: 0 }}>{tools}</div>}
      </div>
      {children}
    </div>
  )
}
