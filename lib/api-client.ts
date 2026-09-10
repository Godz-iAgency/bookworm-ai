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

  // Callers already handle an { error } result to clear their busy state.
  // Token refresh, offline fetches and non-JSON gateway responses must use
  // that same path. Never retry here: these requests can move real money.
  try {
    const token = await user.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "Could not complete your request." } as T;
    }
    if (!res.ok && !data.error) {
      return { error: `Could not complete your request (${res.status}).` } as T;
    }
    return data;
  } catch (err) {
    console.error("Authenticated request failed:", err);
    return { error: "Could not complete your request. Check your connection and try again." } as T;
  }
}
