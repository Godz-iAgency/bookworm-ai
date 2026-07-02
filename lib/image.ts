/**
 * Turn a user-picked image file into a small square avatar as a base64 JPEG
 * data URL. We resize + compress client-side so the result lands around
 * 10–40KB — comfortably under Firestore's 1MB document limit — which lets us
 * store the avatar inline on the user doc without needing Firebase Storage.
 */
export async function fileToAvatarDataUrl(file: File, size = 240): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    // Cover-crop: scale so the shorter side fills the square, then center it.
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
