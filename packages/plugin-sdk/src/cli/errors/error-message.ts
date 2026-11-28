import { stripVTControlCharacters } from "node:util";

export function errorMessage(error: unknown): string {
  return stripVTControlCharacters(
    error instanceof Error ? error.message : String(error),
  );
}
