"use client";

import { auth } from "./firebase/config";

/**
 * POSTs JSON to one of our API routes with the signed-in user's Firebase ID
 * token attached. The server derives the uid from this token
 * (getUidFromRequest in lib/firebase/admin.ts) — never from the body — so
 * callers must NOT pass a uid in `body`.
 */
export async function postAuthed<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    return { error: "You need to be signed in." } as T;
  }

  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  return res.json();
}
