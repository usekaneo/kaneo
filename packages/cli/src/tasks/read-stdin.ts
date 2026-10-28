export async function readStream(
  stream: AsyncIterable<string | Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stream) {
    text +=
      typeof chunk === "string"
        ? chunk
        : decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}
