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
  { value: "sky", key: "sky", label: "Sky", color: "var(--color-sky-500)" },
  {
    value: "cyan",
    key: "lagoon",
    label: "Lagoon",
    color: "var(--color-cyan-600)",
  },
  {
    value: "indigo",
    key: "indigo",
    label: "Indigo",
    color: "var(--color-indigo-500)",
  },
  {
    value: "fuchsia",
    key: "orchid",
    label: "Orchid",
    color: "var(--color-fuchsia-600)",
  },
  { value: "lime", key: "moss", label: "Moss", color: "var(--color-lime-600)" },
  {
    value: "brown",
    key: "walnut",
    label: "Walnut",
    color: "var(--color-amber-900)",
  },
  {
    value: "navy",
    key: "midnight",
    label: "Midnight",
    color: "var(--color-blue-900)",
  },
  {
    value: "coral",
    key: "coral",
    label: "Coral",
    color: "var(--color-red-400)",
  },
] as const;

export type LabelColorValue = (typeof labelColors)[number]["value"];

export default labelColors;
