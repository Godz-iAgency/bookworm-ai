"use client";
import { auth } from "./firebase/config";
const pending = new Map<string, Promise<Response>>();
/** Bind both ends to the initiating identity and share only in-flight study
 * requests. Each caller receives its own response body; mutations never retry.
 */
export async function aiFetch(path: string, init: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const token = await user.getIdToken();
  const study = /^\/api\/course\/(day|flashcards|axiom)$/.test(path);
  const body = study && typeof init.body === "string" ? JSON.parse(init.body) : null;
  const key = user.uid + ':' + path + ':' + (body?.courseId ?? '') + ':' + (body?.dayNumber ?? body?.dayTitle ?? '');
  let task = study ? pending.get(key) : undefined;
  if (!task) {
    task = fetch(path, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + token } });
    if (study) {
      pending.set(key, task);
      const clear = () => { if (pending.get(key) === task) pending.delete(key); };
      task.then(clear, clear);
    }
  }
  const res = await task;
  if (auth.currentUser !== user) throw new Error("Account changed.");
  return study ? res.clone() : res;
}
