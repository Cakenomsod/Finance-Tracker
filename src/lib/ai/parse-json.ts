/**
 * Extract JSON from AI output (handles markdown fences, reasoning prefixes, or extra text).
 */
export function parseJsonFromAiContent(content: string): unknown {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('AI response was empty');
  }

  const candidates = collectJsonCandidates(trimmed);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    lastError?.message?.includes('JSON')
      ? 'AI returned invalid JSON — try again or switch provider'
      : lastError?.message || 'No JSON object found in AI response'
  );
}

function collectJsonCandidates(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  add(text);

  const fences = text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi);
  for (const match of fences) {
    add(match[1]);
  }

  add(extractBalancedJsonObject(text));

  return out;
}

/** Find the first balanced `{ ... }` object, respecting strings and escapes. */
function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
