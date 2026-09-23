export const MODEL = "deepseek/deepseek-v4-flash";
export const LIMIT = 0.85;
export const PRICES = Object.freeze({
  prompt: 0.3,
  completion: 0.6,
  request: 0,
  image: 0,
});

export function reservation(messages, maxTokens, format = null) {
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192)
    throw new Error("Invalid output token limit.");
  // UTF-8 bytes overestimate text tokens; allow ample chat framing overhead.
  const input =
    new TextEncoder().encode(
      JSON.stringify({ messages, response_format: format }),
    ).length + 8192;
  if (input > 180_000)
    throw new Error("Review request exceeds context budget.");
  return (
    Math.ceil(
      ((input * PRICES.prompt + maxTokens * PRICES.completion) / 1e6) *
        1.15 *
        1e8,
    ) / 1e8
  );
}
