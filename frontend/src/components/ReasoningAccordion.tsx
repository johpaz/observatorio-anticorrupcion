import { useState } from 'react'

interface ReasoningAccordionProps {
  reasoning: string
}

export default function ReasoningAccordion({ reasoning }: ReasoningAccordionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden bg-slate-50/80">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#004884] hover:bg-slate-100 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <span>🧠</span>
          <span>Ver razonamiento del modelo</span>
        </span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-slate-200">
          <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-mono">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  )
}
