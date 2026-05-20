function extractJsonObjectSubstring(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

/**
 * Extract assistant text from OpenAI-compatible chat completion payloads
 * (LM Studio, Ollama proxies, etc. may use different field names).
 *
 * Reasoning models (e.g. Gemma 4) often put chain-of-thought in `reasoning_content`
 * and JSON in `content`. We never return raw reasoning unless it contains a JSON object.
 */
export function extractLocalAiMessageContent(data: {
  choices?: Array<{
    message?: Record<string, unknown>;
    text?: string;
  }>;
}): string | null {
  const choice = data.choices?.[0];
  if (!choice) return null;

  const msg = choice.message;
  if (msg) {
    const content = msg.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    const reasoning = msg.reasoning_content ?? msg.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim()) {
      const fromReasoning = extractJsonObjectSubstring(reasoning);
      if (fromReasoning) return fromReasoning;
    }

    const altText = (msg as { text?: string }).text;
    if (typeof altText === 'string' && altText.trim()) {
      return altText.trim();
    }
  }

  if (typeof choice.text === 'string' && choice.text.trim()) {
    return choice.text.trim();
  }

  return null;
}
