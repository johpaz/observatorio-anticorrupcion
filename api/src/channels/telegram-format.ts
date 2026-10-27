import { TelegramChannel } from '@johpaz/hive-sdk/channels'

type Converter = (this: unknown, text: string) => string

// El SDK (0.7.3) convierte negritas, encabezados y código, pero deja enlaces
// [texto](url) y citas "> " como texto crudo. Las respuestas del agente citan
// fuentes con enlaces, así que se completan aquí sobre el HTML ya escapado.
const CODE_SEGMENT = /(<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>)/

function outsideCode(html: string, transform: (s: string) => string): string {
  return html.split(CODE_SEGMENT).map((part, i) => (i % 2 === 1 ? part : transform(part))).join('')
}

function links(s: string): string {
  return s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
}

function quotes(s: string): string {
  return s.replace(/(?:^&gt; ?.*(?:\n|$))+/gm, block => {
    const body = block.replace(/^&gt; ?/gm, '').trimEnd()
    return `<blockquote>${body}</blockquote>${block.endsWith('\n') ? '\n' : ''}`
  })
}

export function markdownToTelegramHTML(text: string): string {
  const base = (TelegramChannel.prototype as unknown as { markdownToHTML: Converter }).markdownToHTML
  return outsideCode(base.call({}, text), s => quotes(links(s)))
}

let installed = false

/** Reemplaza la conversión privada del canal por la extendida. Idempotente. */
export function installTelegramFormatting(): void {
  if (installed) return
  const proto = TelegramChannel.prototype as unknown as { markdownToHTML: Converter }
  const original = proto.markdownToHTML
  proto.markdownToHTML = function (text: string) {
    return outsideCode(original.call(this, text), s => quotes(links(s)))
  }
  installed = true
}
