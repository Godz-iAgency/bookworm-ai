/**
 * Escape raw control characters (newlines, tabs, etc.) that appear *inside*
 * JSON string literals. Gemini's JSON mode sometimes emits multi-paragraph
 * lesson text with literal newlines inside the quotes, which is invalid JSON
 * and breaks JSON.parse ("Bad control character in string literal"). We walk
 * the text tracking string state and escape control chars only inside strings.
 */
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && code < 0x20) {
      if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else out += " "; // any other control char → space
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Parse JSON returned by an LLM. Try a direct parse, then sanitize stray
 * control characters, then fall back to extracting the outermost {...} block.
 */
export function safeParseJson(raw: string): any {
  // 1. Clean parse.
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }

  // 2. Escape control chars inside strings and retry.
  const sanitized = escapeControlCharsInStrings(raw);
  try {
    return JSON.parse(sanitized);
  } catch {
    /* fall through */
  }

  // 3. Extract the outermost object from the sanitized text and parse.
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(sanitized.slice(start, end + 1));
  }

  throw new Error("Could not parse generation output as JSON.");
}
