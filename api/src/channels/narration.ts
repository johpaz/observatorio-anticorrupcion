import { getNarration as getHiveNarration } from '@johpaz/hive-agents-core/gateway/helpers'

const OBSERVATORIO_TOOL_NARRATIONS: Record<string, string> = {
  buscar_contratista: '🔎 Buscando el contratista…',
  obtener_score_riesgo: '📊 Consultando el perfil de riesgo…',
  alertas_sector: '🚨 Analizando las alertas del sector…',
  verificar_sanciones: '🛡️ Verificando sanciones y antecedentes…',
  web_search: '🌐 Buscando información en la web…',
  web_fetch: '📄 Consultando la fuente encontrada…',
}

export function getToolNarration(toolName: string): string {
  return OBSERVATORIO_TOOL_NARRATIONS[toolName] ?? getHiveNarration(toolName)
}
