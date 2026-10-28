export const darkColors = {
  background: "#141414",
  foreground: "#F5F5F5",
  foreground95: "#EAEAEA",
  foreground85: "#D4D4D4",
  subtle: "#A3A3A3",
  mutedForeground: "#818181",
  mutedOnFrame: "#8C8C8C",
  frame: "#1B1B1B",
  card: "#181818",
  column: "#161616",
  border: "#222222",
  input: "#272727",
  control: "#1A1A1A",
  muted: "#1E1E1E",
  warningForeground: "#FFB900",
  destructiveForeground: "#FF6467",
} as const;

const rules: Array<[string, string]> = [
  [".k-bg", `background-color:${darkColors.background}`],
  [".k-text", `color:${darkColors.foreground}`],
  [".k-text-95", `color:${darkColors.foreground95}`],
  [".k-text-85", `color:${darkColors.foreground85}`],
  [".k-subtle", `color:${darkColors.subtle}`],
  [".k-muted", `color:${darkColors.mutedForeground}`],
  [".k-frame .k-muted", `color:${darkColors.mutedOnFrame}`],
  [".k-warning", `color:${darkColors.warningForeground}`],
  [".k-destructive", `color:${darkColors.destructiveForeground}`],
  [".k-frame", `background-color:${darkColors.frame}`],
  [
    ".k-panel",
    `background-color:${darkColors.background};border-color:${darkColors.border}`,
  ],
  [
    ".k-card",
    `background-color:${darkColors.card};border-color:${darkColors.border}`,
  ],
  [
    ".k-column",
    `background-color:${darkColors.column};border-color:${darkColors.border}`,
  ],
  [".k-divider", `border-color:${darkColors.border}`],
  [
    ".k-slot",
    `background-color:${darkColors.control};border-color:${darkColors.input};color:${darkColors.foreground}`,
  ],
  [
    ".k-badge",
    `background-color:transparent;border-color:${darkColors.input};color:${darkColors.foreground}`,
  ],
  [".k-chip", `background-color:${darkColors.muted}`],
  [
    ".k-btn",
    `background-color:${darkColors.foreground};border-color:${darkColors.foreground};color:#262626`,
  ],
  [".k-track", `background-color:${darkColors.input}`],
  [".k-bar", `background-color:${darkColors.foreground}`],
  [".k-link", `color:${darkColors.foreground}`],
];

function important(declarations: string) {
  return declarations
    .split(";")
    .map((declaration) => `${declaration}!important`)
    .join(";");
}

const darkRules = rules
  .map(([selector, declarations]) => `${selector}{${important(declarations)}}`)
  .join("");

const outlookRules = rules
  .map(
    ([selector, declarations]) =>
      `[data-ogsc] ${selector},[data-ogsb] ${selector}{${important(declarations)}}`,
  )
  .join("");

const autolinkReset =
  "color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important";

export const themeCss = [
  ":root{color-scheme:light dark;supported-color-schemes:light dark}",
  `a[x-apple-data-detectors]{${autolinkReset}}`,
  "u + #body a{color:inherit;text-decoration:none;font-size:inherit;font-family:inherit;font-weight:inherit;line-height:inherit}",
  ".k-dark-img{display:none;max-height:0;overflow:hidden}",
  "@media (prefers-color-scheme: dark){",
  darkRules,
  ".k-light-img{display:none!important;max-height:0!important}",
  ".k-dark-img{display:inline-block!important;max-height:none!important;overflow:visible!important}",
  "}",
  outlookRules,
].join("");
