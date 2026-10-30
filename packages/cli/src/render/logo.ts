import type { Ui } from "./ui.js";

export const LOGO_LINES: ReadonlyArray<string> = [
  "    ▄▄▄ ███      ▐█ ▗▟█▀",
  "███ ███ █▛▘      ▐█▄█▛  ▗▄██▙▟█ ▟█▟██▙  ▄███▄▖ ▄▟██▙▄",
  "███ ███ █▖       ▐█▜█▄  ██   ▜█ ██  ▝█▌▟█▄▄▄██▐█▌  ▝█▌",
  "███ ███ ██▙      ▐█ ▀█▙▖▜█▄ ▄▟█ ██   █▌▐█▙ ▗▄▖▝█▙▖▗▟█▘",
  "███ ███ ▀▀▀      ▝▀   ▀▀ ▝▀▀▀▝▀ ▀▀   ▀▘ ▝▀▀▀▀   ▀▀▀▀",
  "▀▀▀",
];

export const LOGO_WIDTH = Math.max(
  ...LOGO_LINES.map((line) => [...line].length),
);

export function logo(ui: Ui, indent = 2): string[] {
  const prefix = " ".repeat(indent);
  if (!ui.caps.unicode) return [`${prefix}${ui.theme.strong("kaneo")}`];
  if (ui.caps.columns < LOGO_WIDTH + indent + 2) {
    return [`${prefix}${ui.theme.strong("▅▆▇ kaneo")}`];
  }
  return LOGO_LINES.map((line) => `${prefix}${line}`);
}
