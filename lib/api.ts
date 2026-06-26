import { Book } from "./BookwormContext";

export async function searchGoogleBooks(query: string): Promise<Book | null> {
  if (!query) return null;

  const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`Book search failed (${res.status})`);
  }

  const data = await res.json();
  return data.book ?? null;
}
