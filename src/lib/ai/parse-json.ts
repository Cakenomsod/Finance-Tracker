/**
 * Extract JSON from AI output (handles markdown fences or extra reasoning text).
 */
export function parseJsonFromAiContent(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // markdown code block
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim());
    }

    // first JSON object in text (skips chain-of-thought prefixes)
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('No JSON object found in AI response');
  }
}
