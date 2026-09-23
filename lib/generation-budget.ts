import { AsyncLocalStorage } from "node:async_hooks";
const deadlines = new AsyncLocalStorage<number>();
export function generationBudget<T>(ms: number, task: () => Promise<T>): Promise<T> {
  return deadlines.run(Date.now() + ms, task);
}
/** Abort a provider call at its own ceiling or the caller's deadline, whichever is sooner. */
export function providerSignal(maxMs = 15000): AbortSignal {
  const remaining = (deadlines.getStore() ?? Date.now() + maxMs) - Date.now();
  if (remaining <= 0) throw new Error("Generation deadline exceeded.");
  return AbortSignal.timeout(Math.min(maxMs, remaining));
}
