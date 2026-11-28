const STATIC_UTILITIES = new Set([
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "contents",
  "flow-root",
  "hidden",
  "table",
  "table-row",
  "table-cell",
  "list-item",
  "static",
  "fixed",
  "absolute",
  "relative",
  "sticky",
  "visible",
  "invisible",
  "collapse",
  "sr-only",
  "not-sr-only",
  "container",
  "isolate",
  "truncate",
  "grow",
  "shrink",
  "border",
  "rounded",
  "shadow",
  "ring",
  "outline",
  "transition",
  "transform",
  "blur",
  "underline",
  "overline",
  "line-through",
  "no-underline",
  "uppercase",
  "lowercase",
  "capitalize",
  "normal-case",
  "italic",
  "not-italic",
  "antialiased",
  "subpixel-antialiased",
  "resize",
  "appearance-none",
]);

const VARIANTS = new Set([
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "hover",
  "focus",
  "focus-visible",
  "focus-within",
  "active",
  "visited",
  "target",
  "disabled",
  "enabled",
  "checked",
  "indeterminate",
  "default",
  "required",
  "valid",
  "invalid",
  "user-valid",
  "user-invalid",
  "in-range",
  "out-of-range",
  "placeholder-shown",
  "autofill",
  "read-only",
  "open",
  "inert",
  "empty",
  "first",
  "last",
  "only",
  "odd",
  "even",
  "first-of-type",
  "last-of-type",
  "only-of-type",
  "before",
  "after",
  "placeholder",
  "file",
  "marker",
  "selection",
  "first-line",
  "first-letter",
  "backdrop",
  "dark",
  "print",
  "motion-safe",
  "motion-reduce",
  "contrast-more",
  "contrast-less",
  "portrait",
  "landscape",
  "ltr",
  "rtl",
  "forced-colors",
  "starting",
  "noscript",
  "*",
  "**",
]);

const VARIANT_FAMILY =
  /^(?:group|peer|data|aria|has|not|in|nth|nth-last|nth-of-type|nth-last-of-type|supports|min|max|pointer|any-pointer)-|^@|^\[/;

const ARBITRARY = String.raw`(?:\[[^\]]+\]|\([^)]+\))`;
const SCALE = String.raw`(?:\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|screen|min|max|fit|${ARBITRARY})`;
const SIZE = String.raw`(?:xs|sm|md|lg|xl|[2-9]xl|base|none|full)`;
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const KANEO_COLORS =
  "background|foreground|primary|secondary|muted|accent|destructive|border|input|ring|card|popover|sidebar|success|warning|info|code|chart-[1-5]";
const COLOR = String.raw`(?:inherit|current|transparent|black|white|(?:${PALETTE})-(?:50|[1-9]00|950)|(?:${KANEO_COLORS})(?:-(?:primary|accent))?(?:-(?:foreground|border|ring|highlight))?|${ARBITRARY})`;

const SCALED =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h|inset|inset-x|inset-y|top|right|bottom|left|start|end|translate-x|translate-y|basis|z|order|opacity|col|row|col-span|row-span|col-start|col-end|row-start|row-end|grid-cols|grid-rows|line-clamp|leading|duration|delay|scale|rotate|border|border-t|border-r|border-b|border-l|border-x|border-y|ring|ring-offset|outline|outline-offset|underline-offset|indent|columns|flex|grow|shrink";
const SIZED =
  "text|w|min-w|max-w|rounded|rounded-t|rounded-r|rounded-b|rounded-l|rounded-s|rounded-e|rounded-tl|rounded-tr|rounded-bl|rounded-br|shadow|inset-shadow|drop-shadow|blur|backdrop-blur";
const COLORED =
  "bg|text|border|border-t|border-r|border-b|border-l|border-x|border-y|ring|ring-offset|outline|fill|stroke|from|via|to|divide|accent|caret|decoration|placeholder|shadow";

const KEYWORDS: Record<string, string> = {
  flex: "row|col|row-reverse|col-reverse|wrap|nowrap|wrap-reverse|auto|initial|none",
  items: "start|end|center|baseline|stretch",
  self: "auto|start|end|center|baseline|stretch",
  justify: "start|end|center|between|around|evenly|stretch|normal",
  content: "start|end|center|between|around|evenly|stretch|normal|none",
  "place-items": "start|end|center|baseline|stretch",
  "place-content": "start|end|center|between|around|evenly|stretch",
  "place-self": "auto|start|end|center|stretch",
  overflow: "auto|hidden|clip|visible|scroll",
  "overflow-x": "auto|hidden|clip|visible|scroll",
  "overflow-y": "auto|hidden|clip|visible|scroll",
  whitespace: "normal|nowrap|pre|pre-line|pre-wrap|break-spaces",
  break: "normal|words|all|keep",
  text: "left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip",
  font: "thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|serif|mono|heading",
  leading: "none|tight|snug|normal|relaxed|loose",
  tracking: "tighter|tight|normal|wide|wider|widest",
  cursor:
    "auto|default|pointer|wait|text|move|help|not-allowed|none|grab|grabbing|ew-resize|ns-resize|col-resize|row-resize",
  "pointer-events": "none|auto",
  select: "none|text|all|auto",
  touch: "auto|none|pan-x|pan-y|manipulation|pinch-zoom",
  object: "contain|cover|fill|none|scale-down|center|top|bottom|left|right",
  transition: "all|colors|opacity|shadow|transform|none",
  ease: "linear|in|out|in-out",
  border: "solid|dashed|dotted|double|none|hidden",
  outline: "none|hidden|solid|dashed|dotted|double",
  aspect: "auto|square|video",
  list: "none|disc|decimal|inside|outside",
  align: "baseline|top|middle|bottom|text-top|text-bottom|sub|super",
  resize: "none|x|y",
};

const KEYWORD_UTILITY = new RegExp(
  `^(?:${Object.entries(KEYWORDS)
    .map(([family, values]) => `${family}-(?:${values})`)
    .join("|")})$`,
);
const SCALED_UTILITY = new RegExp(`^-?(?:${SCALED})-${SCALE}$`);
const SIZED_UTILITY = new RegExp(`^(?:${SIZED})-${SIZE}$`);
const COLOR_UTILITY = new RegExp(`^(?:${COLORED})-${COLOR}(?:\\/\\d+)?$`);

function splitVariants(name: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < name.length; index++) {
    const char = name[index];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth = Math.max(0, depth - 1);
    else if (char === ":" && depth === 0) {
      segments.push(name.slice(start, index));
      start = index + 1;
    }
  }
  segments.push(name.slice(start));
  return segments;
}

function isVariant(segment: string): boolean {
  return VARIANTS.has(segment) || VARIANT_FAMILY.test(segment);
}

function isUtility(candidate: string): boolean {
  const utility = candidate.replace(/^!|!$/g, "");
  return (
    STATIC_UTILITIES.has(utility) ||
    KEYWORD_UTILITY.test(utility) ||
    SCALED_UTILITY.test(utility) ||
    SIZED_UTILITY.test(utility) ||
    COLOR_UTILITY.test(utility)
  );
}

export function isTailwindClass(name: string): boolean {
  const variants = splitVariants(name);
  const utility = variants.pop() ?? "";
  return variants.every(isVariant) && isUtility(utility);
}
