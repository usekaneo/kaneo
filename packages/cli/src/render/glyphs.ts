export type Glyphs = {
  readonly tick: string;
  readonly cross: string;
  readonly dot: string;
  readonly diamond: string;
  readonly arrow: string;
  readonly ellipsis: string;
  readonly separator: string;
  readonly warning: string;
  readonly due: string;
  readonly priority: {
    readonly empty: string;
    readonly low: string;
    readonly medium: string;
    readonly high: string;
    readonly urgent: string;
  };
  readonly box: {
    readonly topLeft: string;
    readonly topRight: string;
    readonly bottomLeft: string;
    readonly bottomRight: string;
    readonly horizontal: string;
    readonly vertical: string;
  };
  readonly spinner: ReadonlyArray<string>;
};

export const unicodeGlyphs: Glyphs = {
  tick: "✓",
  cross: "✗",
  dot: "●",
  diamond: "◆",
  arrow: "→",
  ellipsis: "…",
  separator: "·",
  warning: "▲",
  due: "◷",
  priority: {
    empty: "▁",
    low: "▂",
    medium: "▄",
    high: "▆",
    urgent: "▲",
  },
  box: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

export const asciiGlyphs: Glyphs = {
  tick: "+",
  cross: "x",
  dot: "*",
  diamond: "#",
  arrow: "->",
  ellipsis: "...",
  separator: "-",
  warning: "!",
  due: "",
  priority: {
    empty: ".",
    low: "_",
    medium: "=",
    high: "#",
    urgent: "!",
  },
  box: {
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    horizontal: "-",
    vertical: "|",
  },
  spinner: ["|", "/", "-", "\\"],
};

export function glyphsFor(unicode: boolean): Glyphs {
  return unicode ? unicodeGlyphs : asciiGlyphs;
}
