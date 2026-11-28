import type { Console } from "effect";

export function capturingConsole(lines: string[]): Console.Console {
  const push = (...args: ReadonlyArray<unknown>) => {
    lines.push(args.map(String).join(" "));
  };
  return Object.assign(Object.create(globalThis.console), {
    log: push,
    info: push,
    warn: push,
    error: push,
    debug: () => {},
  });
}
