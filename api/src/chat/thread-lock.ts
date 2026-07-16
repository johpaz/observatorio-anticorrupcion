const threadQueues = new Map<string, Promise<void>>()

/** Serialize operations that read or mutate the same conversation context. */
export async function withThreadLock<T>(threadId: string, operation: () => Promise<T> | T): Promise<T> {
  const previous = threadQueues.get(threadId) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(operation)
  const settled = run.then(() => undefined, () => undefined)

  threadQueues.set(threadId, settled)

  try {
    return await run
  } finally {
    if (threadQueues.get(threadId) === settled) {
      threadQueues.delete(threadId)
    }
  }
}
