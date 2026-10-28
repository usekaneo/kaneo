import { type KeyCombo, parseBinding } from "./key-combo";

const SPECIAL: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  enter: "↵",
  escape: "Esc",
  space: "Space",
  tab: "Tab",
};

export type FormattedBinding = string[][];

export function formatCombo(combo: KeyCombo, isMac: boolean) {
  const caps: string[] = [];
  if (combo.mod) caps.push(isMac ? "⌘" : "Ctrl");
  if (combo.ctrl) caps.push(isMac ? "⌃" : "Ctrl");
  if (combo.alt) caps.push(isMac ? "⌥" : "Alt");
  if (combo.shift) caps.push(isMac ? "⇧" : "Shift");
  caps.push(SPECIAL[combo.key] ?? combo.key.toUpperCase());
  return caps;
}

export function formatBinding(keys: string, isMac: boolean): FormattedBinding {
  return parseBinding(keys).map((combo) => formatCombo(combo, isMac));
}
