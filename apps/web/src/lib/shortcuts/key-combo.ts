export type KeyCombo = {
  key: string;
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
};

export type Binding = KeyCombo[];

const CODE_KEYS: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Quote: "'",
  Semicolon: ";",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
};

export function parseCombo(input: string): KeyCombo {
  const parts = input.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return {
    key,
    mod: parts.includes("mod"),
    ctrl: parts.includes("ctrl"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };
}

export function parseBinding(input: string): Binding {
  return input.trim().split(/\s+/).map(parseCombo);
}

function codeKey(code: string) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return CODE_KEYS[code];
}

type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function eventKey(event: KeyEventLike) {
  if (event.key === " ") return "space";
  if (event.key.length > 1) return event.key.toLowerCase();
  const printable = /^[\x21-\x7e]$/.test(event.key);
  if (printable && !event.altKey) return event.key.toLowerCase();
  return codeKey(event.code) ?? event.key.toLowerCase();
}

const isAlphanumeric = (key: string) => /^[a-z0-9]$/.test(key);

export function matchesCombo(
  combo: KeyCombo,
  event: KeyEventLike,
  isMac: boolean,
) {
  const wantMeta = combo.mod && isMac;
  const wantCtrl = combo.ctrl || (combo.mod && !isMac);
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl) return false;
  if (event.altKey !== combo.alt) return false;

  const typed = eventKey(event);
  if (event.shiftKey === combo.shift) {
    return (
      typed === combo.key ||
      (event.shiftKey && codeKey(event.code) === combo.key)
    );
  }
  return (
    !combo.shift &&
    event.shiftKey &&
    !isAlphanumeric(combo.key) &&
    event.key === combo.key
  );
}
