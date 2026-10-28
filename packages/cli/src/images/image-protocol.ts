import type {
  ColorLevel,
  Environment,
  StreamInfo,
} from "../render/capabilities.js";

export type ImageProtocol = "kitty" | "iterm" | "blocks" | "none";

export type ImageContext = {
  readonly json: boolean;
  readonly color: ColorLevel;
  readonly unicode: boolean;
};

const OFF = new Set(["off", "0", "false", "no", "none"]);
const FORCED = new Set<ImageProtocol>(["kitty", "iterm", "blocks"]);

function forcedProtocol(env: Environment): ImageProtocol | "off" | undefined {
  const setting = env.KANEO_IMAGES?.trim().toLowerCase();
  if (!setting) return undefined;
  if (OFF.has(setting)) return "off";
  return FORCED.has(setting as ImageProtocol)
    ? (setting as ImageProtocol)
    : undefined;
}

export function inTmux(env: Environment): boolean {
  return Boolean(env.TMUX);
}

function inMultiplexer(env: Environment): boolean {
  return inTmux(env) || Boolean(env.STY) || Boolean(env.ZELLIJ);
}

function speaksKitty(env: Environment): boolean {
  return (
    env.TERM === "xterm-kitty" ||
    env.TERM === "xterm-ghostty" ||
    env.TERM_PROGRAM === "ghostty" ||
    Boolean(env.KITTY_WINDOW_ID)
  );
}

function speaksIterm(env: Environment): boolean {
  return (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.LC_TERMINAL === "iTerm2"
  );
}

export function detectImageProtocol(
  env: Environment,
  stream: StreamInfo,
  context: ImageContext,
): ImageProtocol {
  if (context.json) return "none";
  const forced = forcedProtocol(env);
  if (forced === "off") return "none";
  if (forced) return forced;
  if (!stream.isTTY || env.TERM === "dumb") return "none";
  const blocks = context.color >= 2 && context.unicode ? "blocks" : "none";
  if (inMultiplexer(env)) return blocks;
  if (speaksKitty(env)) return "kitty";
  if (speaksIterm(env)) return "iterm";
  return blocks;
}
