// Keep in step with apps/api/src/contact/options.ts; labels live in i18n.
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

export const contactTypeKey = (type: string) =>
  `workspace:contacts.types.${type}`;
export const contactRegionKey = (region: string) =>
  `workspace:contacts.regions.${region}`;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactRegion = (typeof CONTACT_REGIONS)[number];
