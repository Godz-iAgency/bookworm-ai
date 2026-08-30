"use client";

/**
 * Turn a camera photo into a small JPEG before it goes anywhere.
 *
 * A phone photo is commonly 3000-4000px and several megabytes; a book cover
 * only needs to be legible, not print quality. Sending the original would make
 * every scan a slow upload and a needlessly large, needlessly costly vision
 * call for no gain in accuracy.
 */
function downscaleImage(file: File, maxDim = 1024, quality = 0.85): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("This browser can't process the photo."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const data = dataUrl.split(",")[1];
      if (!data) {
        reject(new Error("Could not process that photo."));
        return;
      }
      resolve({ data, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That doesn't look like an image file."));
    };
    img.src = url;
  });
}

/** What the server could read off the cover. Null when it couldn't confidently tell. */
export interface ScannedBook {
  title: string;
  author: string;
}

/**
 * Downscale a captured photo and ask the server to read the book off it.
 * Throws on a real failure (network, server error); returns null when the
 * photo simply wasn't a clear enough shot of a book to identify.
 */
export async function scanBookCover(file: File): Promise<ScannedBook | null> {
  const { data, mimeType } = await downscaleImage(file);

  const res = await fetch("/api/books/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: data, mimeType }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Cover scan failed (${res.status})`);
  }

  const body = await res.json();
  return body.book ?? null;
}
