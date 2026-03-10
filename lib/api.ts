import { Book } from "./BookwormContext";

export async function searchGoogleBooks(query: string): Promise<Book | null> {
  if (!query) return null;
  
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`);
    
    if (!res.ok) {
      if (res.status === 429) {
        console.warn("Google Books API 429 Rate Limit hit. Using mock data fallback.");
        return getMockBook(query);
      }
      throw new Error("Failed to fetch book data");
    }

    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      return {
        title: volumeInfo.title || "Unknown Title",
        author: volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author",
        coverUrl: volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:") || "/placeholder-book.png",
        description: volumeInfo.description 
          ? volumeInfo.description.substring(0, 150) + "..." 
          : "No description available for this book.",
      };
    }
    return null;
  } catch (error) {
    console.warn("API request failed. Reserving to mock data for Phase 1.", error);
    return getMockBook(query);
  }
}

// Fallback logic implemented to preserve the demo capability if Google API rate limits us (429)
function getMockBook(query: string): Book {
  return {
    title: query.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    author: "Demonstration Author",
    coverUrl: "/placeholder.svg?height=300&width=200",
    description: "A profound book filled with wisdom and insights designed to elevate your thinking and transform your approach to daily life and career.",
  };
}
