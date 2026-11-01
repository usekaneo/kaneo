// Fixed lists keep filtering clean. Edit here to change what the app offers;
// stored values are the slugs, so renaming a label never breaks existing rows.
export const CONTACT_TYPES = [
  "retailer",
  "distributor",
  "end-user",
  "partner",
  "other",
] as const;

export const CONTACT_REGIONS = [
  "male",
  "hulhumale",
  "north-atolls",
  "central-atolls",
  "south-atolls",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactRegion = (typeof CONTACT_REGIONS)[number];
