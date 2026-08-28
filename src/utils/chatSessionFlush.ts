type FlushFn = () => void | Promise<void>;

const flushes = new Set<FlushFn>();

/** Active Orion/Agent sessions register so leave paths can abort in-flight runs. */
export function registerChatSessionFlush(fn: FlushFn): () => void {
  flushes.add(fn);
  return () => {
    flushes.delete(fn);
  };
}

export async function flushChatSessions(): Promise<void> {
  await Promise.all([...flushes].map((fn) => fn()));
}
