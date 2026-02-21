import type { OpenClawEvent } from "./mapper.js";

/** Extract complete JSON objects from buffer; handles newlines inside strings. */
export function extractObjects(text: string): { objects: string[]; tail: string } {
  const objects: string[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /[\s\n\r\t]/.test(text[i])) i++;
    if (i >= len) break;

    if (text[i] !== "{") {
      i++;
      continue;
    }

    const start = i;
    let depth = 0;
    let inString = false;
    let escape = false;
    let quote = "";

    for (; i < len; i++) {
      const c = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (inString) {
        if (c === "\\") escape = true;
        else if (c === quote) inString = false;
        continue;
      }

      if (c === '"') {
        inString = true;
        quote = '"';
        continue;
      }

      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          objects.push(text.slice(start, i + 1));
          i++;
          break;
        }
      }
    }

    if (depth !== 0) {
      return { objects, tail: text.slice(start) };
    }
  }

  return { objects, tail: "" };
}

export function parseObject(jsonStr: string): OpenClawEvent | null {
  try {
    const parsed = JSON.parse(jsonStr) as OpenClawEvent;
    return typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
