export const CONTACT_OPTION_KINDS = ["type", "region"] as const;
export type ContactOptionKind = (typeof CONTACT_OPTION_KINDS)[number];

// Seeded into each workspace the first time its options are used. The keys are
// the values contacts already stored before options became editable, so
// existing contacts stay valid.
export const DEFAULT_CONTACT_OPTIONS: Record<
  ContactOptionKind,
  readonly { key: string; label: string }[]
> = {
  type: [
    { key: "retailer", label: "Retailer" },
    { key: "distributor", label: "Distributor" },
    { key: "end-user", label: "End user" },
    { key: "partner", label: "Partner" },
    { key: "other", label: "Other" },
  ],
  region: [
    { key: "male", label: "Malé" },
    { key: "hulhumale", label: "Hulhumalé" },
    { key: "north-atolls", label: "North atolls" },
    { key: "central-atolls", label: "Central atolls" },
    { key: "south-atolls", label: "South atolls" },
    { key: "other", label: "Other" },
  ],
};

export const MAX_LABEL_LENGTH = 120;
export const MAX_LABELS_PER_REQUEST = 500;
export const MAX_OPTIONS_PER_KIND = 2000;
