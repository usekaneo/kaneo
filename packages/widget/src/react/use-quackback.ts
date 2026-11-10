import Quackback from "../index.js";

/**
 * Returns the Quackback singleton. Equivalent to importing it directly —
 * exists for React-idiomatic usage.
 */
export function useQuackback(): typeof Quackback {
  return Quackback;
}
