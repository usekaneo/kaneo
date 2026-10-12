export type ColorLevel = 0 | 1 | 2 | 3;

export type Capabilities = {
  readonly color: ColorLevel;
  readonly unicode: boolean;
  readonly hyperlinks: boolean;
  readonly animate: boolean;
  readonly columns: number;
};

export type Environment = Readonly<Record<string, string | undefined>>;

export type StreamInfo = {
  readonly isTTY: boolean;
  readonly columns: number | undefined;
};

const TRUECOLOR_PROGRAMS = new Set([
  "iTerm.app",
  "WezTerm",
  "vscode",
  "ghostty",
]);

const HYPERLINK_PROGRAMS = new Set([
  "iTerm.app",
  "WezTerm",
  "vscode",
  "ghostty",
  "Hyper",
  "Tabby",
]);

const HYPERLINK_TERMS = new Set([
  "xterm-kitty",
  "xterm-ghostty",
  "alacritty",
  "foot",
  "wezterm",
]);

export function detectColorLevel(
  env: Environment,
  stream: StreamInfo,
  platform: string,
): ColorLevel {
  const forced = env.FORCE_COLOR;
  if (forced !== undefined) {
    if (forced === "0" || forced === "false") return 0;
    if (forced === "2") return 2;
    if (forced === "3") return 3;
    return 1;
  }
  if (env.NO_COLOR) return 0;
  if (env.TERM === "dumb") return 0;
  if (!stream.isTTY) return 0;
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return 3;
  if (env.TERM_PROGRAM && TRUECOLOR_PROGRAMS.has(env.TERM_PROGRAM)) return 3;
  if (platform === "win32") return env.WT_SESSION ? 3 : 1;
  if (env.TERM && /-256(color)?$/i.test(env.TERM)) return 2;
  return 1;
}

export function detectUnicode(env: Environment, platform: string): boolean {
  if (env.TERM === "dumb") return false;
  if (platform === "win32") {
    return Boolean(env.WT_SESSION || env.TERM_PROGRAM || env.ConEmuTask);
  }
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG;
  if (!locale) return true;
  return /utf-?8/i.test(locale);
}

export function detectHyperlinks(
  env: Environment,
  stream: StreamInfo,
): boolean {
  const forced = env.FORCE_HYPERLINK;
  if (forced !== undefined) return forced !== "0" && forced !== "false";
  if (!stream.isTTY || env.TERM === "dumb") return false;
  if (env.TERM_PROGRAM && HYPERLINK_PROGRAMS.has(env.TERM_PROGRAM)) return true;
  if (env.TERM && HYPERLINK_TERMS.has(env.TERM)) return true;
  if (env.WT_SESSION || env.KONSOLE_VERSION || env.KITTY_WINDOW_ID) return true;
  const vte = Number(env.VTE_VERSION);
  return Number.isFinite(vte) && vte >= 5000;
}

export function detectCapabilities(
  env: Environment,
  stream: StreamInfo,
  platform: string,
): Capabilities {
  const columns = stream.columns ?? Number(env.COLUMNS);
  return {
    color: detectColorLevel(env, stream, platform),
    unicode: detectUnicode(env, platform),
    hyperlinks: detectHyperlinks(env, stream),
    animate: stream.isTTY && env.TERM !== "dumb" && !env.CI,
    columns: Number.isFinite(columns) && columns > 0 ? columns : 80,
  };
}

export const plainCapabilities: Capabilities = {
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
};
