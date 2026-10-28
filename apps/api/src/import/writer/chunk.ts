export const IMPORT_CHUNK_SIZE = 500;

export function chunk<T>(items: readonly T[], size = IMPORT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}
