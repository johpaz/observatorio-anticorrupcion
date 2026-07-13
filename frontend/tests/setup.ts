import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({ url: 'http://localhost:5173/' })

// React Testing Library usa act() — requerido para evitar warnings/errores
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Recharts (ResponsiveContainer) requiere ResizeObserver; happy-dom puede no traerlo
if (!(globalThis as any).ResizeObserver) {
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
