// Hex values taken from PLANKA's own stylesheet.
const LABEL_COLORS: Record<string, string> = {
  "muddy-grey": "#69655a",
  "autumn-leafs": "#c9b037",
  "morning-sky": "#52b9d5",
  "antique-blue": "#6c99bb",
  "egg-yellow": "#f9c423",
  "desert-sand": "#fad371",
  "dark-granite": "#8b8680",
  "fresh-salad": "#ced85e",
  "lagoon-blue": "#109dc0",
  "midnight-blue": "#0a63a0",
  "light-orange": "#fdae5f",
  "pumpkin-orange": "#ed9223",
  "light-concrete": "#afb0a4",
  "sunny-grass": "#beca02",
  "navy-blue": "#1d7299",
  "lilac-eyes": "#406cbd",
  "apricot-red": "#fc736c",
  "orange-peel": "#de692f",
  // Gradient in PLANKA; collapsed to its dominant stop.
  "silver-glint": "#92908d",
  "bright-moss": "#96b352",
  "deep-ocean": "#004c70",
  "summer-sky": "#5d9cec",
  "berry-red": "#e83855",
  "light-cocoa": "#a85540",
  "grey-stone": "#aab2bd",
  "tank-green": "#8aa177",
  "coral-green": "#2b6a6c",
  "sugar-plum": "#7e86c7",
  "pink-tulip": "#e34f7c",
  "shady-rust": "#87564a",
  "wet-rock": "#83949b",
  "wet-moss": "#4a8753",
  "turquoise-sea": "#00858a",
  "lavender-fields": "#b287bd",
  "piggy-red": "#f97394",
  "light-mud": "#c7a57a",
  "gun-metal": "#4f6573",
  "modern-green": "#77ce87",
  "french-coast": "#00b4b1",
  "sweet-lilac": "#975298",
  "red-burgundy": "#ad5f7d",
  // Gradient in PLANKA; collapsed to its dominant stop.
  "pirate-gold": "#b47e11",
};

const FALLBACK_COLOR = "#6b7280";

export function labelColorToHex(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR;
  return LABEL_COLORS[color] ?? FALLBACK_COLOR;
}

export { FALLBACK_COLOR, LABEL_COLORS };
