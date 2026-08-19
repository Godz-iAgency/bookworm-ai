/**
 * Amazon affiliate links, shared by the 7-day course completion banner and the
 * Personal Development summary reader.
 *
 * A search link rather than a product link: it works for every book in the
 * library without needing a stored ASIN per title, and it survives an edition
 * going out of print.
 */
export function buildAmazonLink(title: string, author: string) {
  const q = encodeURIComponent(`${title} ${author}`.trim());
  return `https://www.amazon.com/s?k=${q}&tag=bookwormapp-20`;
}
