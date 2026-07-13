import { useEffect } from 'react'

const SITE_NAME = 'Observatorio Anticorrupción de Colombia'

export function useSeo(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} | Contratación Pública SECOP II`

    if (description) {
      const meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', description)
    }
  }, [title, description])
}
