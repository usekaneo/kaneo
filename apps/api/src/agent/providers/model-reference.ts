// Unqualified IDs keep their original OpenRouter meaning, including :free.
export function parseModelReference(id: string) {
  if (!/^[^\s,]{1,200}$/.test(id)) return null;
  const qualified = /^([a-z][a-z0-9-]*):(.*)$/.exec(id);
  if (!qualified) return { provider: "openrouter", model: id };
  if (!qualified[2]) return null;
  return { provider: qualified[1]!, model: qualified[2] };
}
