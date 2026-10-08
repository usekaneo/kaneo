import { createInterface } from "node:readline/promises";
import type { Prompt } from "./io";

export function terminalPrompt(): Prompt {
  return {
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    async ask(question) {
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        return (await readline.question(question)).trim();
      } finally {
        readline.close();
      }
    },
  };
}
