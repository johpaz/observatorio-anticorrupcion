export interface ChatHistoryResponse {
  messages: {
    id: number
    role: 'user' | 'assistant'
    content: string
    reasoning?: string
    tool_calls?: {
      id: string
      name: string
      args: Record<string, unknown>
      result?: unknown
    }[]
    iterations?: number
    review?: { approved: boolean; feedback: string; missing: string[] }
    created_at: number
  }[]
  next_before_id: number | null
  has_more: boolean
}

export async function fetchChatHistory(beforeId?: number, signal?: AbortSignal): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams({ limit: '50' })
  if (beforeId) params.set('before_id', String(beforeId))
  const response = await fetch(`/api/chat/history?${params}`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json() as Promise<ChatHistoryResponse>
}

export async function deleteChatHistory(): Promise<void> {
  const response = await fetch('/api/chat/history', {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
}
