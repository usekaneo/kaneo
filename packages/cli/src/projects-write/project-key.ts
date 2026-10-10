import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const MAX_KEY_LENGTH = 8;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const KEY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*$/u;

function firstLetterOrNumber(word: string): string {
  for (const char of word) {
    if (LETTER_OR_NUMBER.test(char)) return char;
  }
  return "";
}

export function deriveProjectKey(name: string): string {
  const words = name
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((word) => LETTER_OR_NUMBER.test(word));
  const [first] = words;
  if (first === undefined) return "";
  if (words.length === 1) {
    const codePoints = Array.from(first);
    const start = codePoints.findIndex((char) => LETTER_OR_NUMBER.test(char));
    return codePoints.slice(start, start + 3).join("");
  }
  return words.slice(0, 3).map(firstLetterOrNumber).join("");
}

export function validateProjectKey(
  input: string,
  flag = "--key",
): Result.Result<string, InvalidArgument> {
  const key = input.normalize("NFKC").trim().toUpperCase();
  if (key === "") {
    return Result.fail(
      new InvalidArgument({
        message: "The project key cannot be empty.",
        hint: `Pass ${flag} with a short key, for example ${flag} KAN.`,
      }),
    );
  }
  if (Array.from(key).length > MAX_KEY_LENGTH) {
    return Result.fail(
      new InvalidArgument({
        message: `The project key "${key}" is longer than ${MAX_KEY_LENGTH} characters.`,
        hint: `Pick a key of at most ${MAX_KEY_LENGTH} letters or numbers.`,
      }),
    );
  }
  if (!KEY_PATTERN.test(key)) {
    return Result.fail(
      new InvalidArgument({
        message: `The project key "${key}" can only contain letters and numbers.`,
        hint: "Task ids look like KEY-12, so leave out spaces, dashes and punctuation.",
      }),
    );
  }
  return Result.succeed(key);
}

function normalized(key: string): string {
  return key.normalize("NFKC").toLowerCase();
}

export function suggestProjectKey(
  name: string,
  key: string,
  taken: ReadonlyArray<string>,
): string | undefined {
  const used = new Set(taken.map(normalized));
  const free = (candidate: string) =>
    KEY_PATTERN.test(candidate) && !used.has(normalized(candidate));
  const letters = Array.from(
    name
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[^\p{L}\p{M}\p{N}]/gu, ""),
  );
  const keyLength = Array.from(key).length;
  for (let length = keyLength + 1; length <= 4; length++) {
    const candidate = letters.slice(0, length).join("");
    if (Array.from(candidate).length === length && free(candidate)) {
      return candidate;
    }
  }
  const stem = Array.from(key);
  for (let suffix = 2; suffix < 100; suffix++) {
    const digits = String(suffix);
    const candidate =
      stem.slice(0, MAX_KEY_LENGTH - digits.length).join("") + digits;
    if (free(candidate)) return candidate;
  }
  return undefined;
}
