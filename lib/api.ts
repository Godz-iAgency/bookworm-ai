import { Book } from "./BookwormContext";

export async function searchGoogleBooks(query: string): Promise<Book | null> {
  if (!query) return null;
  
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
    const url = apiKey 
      ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;

    const res = await fetch(url);
    
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Google Books API rate limit reached. Please try again later.");
      }
      throw new Error(`Failed to fetch book data. Status: ${res.status}`);
    }

    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      return {
        title: volumeInfo.title || "Unknown Title",
        author: volumeInfo.authors && volumeInfo.authors.length > 0 ? volumeInfo.authors[0] : "Unknown Author",
        coverUrl: volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:") || "/placeholder.jpg",
        description: volumeInfo.description 
          ? volumeInfo.description.substring(0, 150) + "..." 
          : "No description available for this book.",
      };
    }
    return null;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}
