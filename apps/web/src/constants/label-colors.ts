const labelColors = [
  {
    value: "gray",
    key: "stone",
    label: "Stone",
    color: "var(--color-stone-500)",
  },
  {
    value: "dark-gray",
    key: "slate",
    label: "Slate",
    color: "var(--color-slate-500)",
  },
  {
    value: "purple",
    key: "lavender",
    label: "Lavender",
    color: "var(--color-violet-500)",
  },
  {
    value: "teal",
    key: "sage",
    label: "Sage",
    color: "var(--color-emerald-600)",
  },
  {
    value: "green",
    key: "forest",
    label: "Forest",
    color: "var(--color-green-600)",
  },
  {
    value: "yellow",
    key: "amber",
    label: "Amber",
    color: "var(--color-amber-600)",
  },
  {
    value: "orange",
    key: "terracotta",
    label: "Terracotta",
    color: "var(--color-orange-600)",
  },
  { value: "pink", key: "rose", label: "Rose", color: "var(--color-rose-600)" },
  {
    value: "red",
    key: "crimson",
    label: "Crimson",
    color: "var(--color-red-600)",
  },
  {
    value: "blue",
    key: "ocean",
    label: "Ocean",
    color: "var(--color-blue-600)",
  },
  {
    value: "bright-yellow",
    key: "sunflower",
    label: "Sunflower",
    color: "var(--color-yellow-400)",
  },
  {
    value: "pale-pink",
    key: "blush",
    label: "Blush",
    color: "var(--color-pink-300)",
  },
  {
    value: "pale-purple",
    key: "lilac",
    label: "Lilac",
    color: "var(--color-violet-300)",
  },
  {
    value: "pale-green",
    key: "mint",
    label: "Mint",
    color: "var(--color-emerald-300)",
  },
  {
    value: "pale-blue",
    key: "powder",
    label: "Powder blue",
    color: "var(--color-sky-300)",
  },
  {
    value: "pale-orange",
    key: "peach",
    label: "Peach",
    color: "var(--color-orange-300)",
  },
  {
    value: "pale-gray",
    key: "mist",
    label: "Mist",
    color: "var(--color-stone-300)",
  },
  {
    value: "black",
    key: "ink",
    label: "Ink",
    color: "var(--color-neutral-900)",
  },
] as const;

export type LabelColorValue = (typeof labelColors)[number]["value"];

// Briefly offered, no longer in the pickers; labels that use them keep their color.
export const retiredLabelColors = [
  { value: "sky", color: "var(--color-sky-500)" },
  { value: "cyan", color: "var(--color-cyan-600)" },
  { value: "indigo", color: "var(--color-indigo-500)" },
  { value: "fuchsia", color: "var(--color-fuchsia-600)" },
  { value: "lime", color: "var(--color-lime-600)" },
  { value: "brown", color: "var(--color-amber-900)" },
  { value: "navy", color: "var(--color-blue-900)" },
  { value: "coral", color: "var(--color-red-400)" },
] as const;

export default labelColors;
