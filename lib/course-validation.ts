/** Validate provider output before any reader receives it. */
export function validDeck(value: any): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(c => c && typeof c.front === "string" && c.front.trim() && typeof c.back === "string" && c.back.trim());
}
export function validLesson(value: any): boolean {
  return !!value && typeof value.lesson === "string" && !!value.lesson.trim() && validDeck(value.flashcards) && typeof value.closingAxiom === "string" && !!value.closingAxiom.trim() && Array.isArray(value.chatSeed) && value.chatSeed.length === 3 && value.chatSeed.every((s: any) => typeof s === "string" && s.trim());
}
export function validOutline(value: any): boolean {
  return Array.isArray(value?.days) && value.days.length === 7 && value.days.every((d: any, i: number) => d && typeof d.title === "string" && d.title.trim() && (d.dayNumber === undefined || d.dayNumber === i + 1) && typeof d.previewText === "string" && (d.lesson === undefined || typeof d.lesson === "string") && (d.flashcards === undefined || Array.isArray(d.flashcards) && d.flashcards.every((c: any) => c && typeof c.front === "string" && typeof c.back === "string")) && (d.chatSeed === undefined || Array.isArray(d.chatSeed) && d.chatSeed.every((v: any) => typeof v === "string"))) && validLesson(value.days[0]);
}
