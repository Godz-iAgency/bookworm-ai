import { AsyncLocalStorage } from "node:async_hooks";
const deadlines = new AsyncLocalStorage<number>();
export function generationBudget<T>(ms: number, task: () => Promise<T>): Promise<T> {
  return deadlines.run(Date.now() + ms, task);
}
export function providerSignal(): AbortSignal {
  const remaining = (deadlines.getStore() ?? Date.now() + 15000) - Date.now();
  if (remaining <= 0) throw new Error("Generation deadline exceeded.");
  return AbortSignal.timeout(Math.min(15000, remaining));
}
