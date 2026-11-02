import { z } from "../../openapi";
import {
  CONTACT_OPTION_KINDS,
  MAX_LABEL_LENGTH,
  MAX_LABELS_PER_REQUEST,
  MAX_OPTIONS_PER_KIND,
} from "./defaults";

const kind = z.enum(CONTACT_OPTION_KINDS).openapi({
  description: "`type` for contact types, `region` for locations.",
});
const label = z.string().trim().max(MAX_LABEL_LENGTH).openapi({
  description: "Name shown to people; unique per list, ignoring case.",
});

export const kindParam = z.object({ kind });
export const optionParam = z.object({ kind, key: z.string().min(1) });

export const createOptionsBody = z
  .object({
    kind,
    label: label.optional().openapi({ description: "A single name to add." }),
    labels: z
      .array(label)
      .max(MAX_LABELS_PER_REQUEST)
      .optional()
      .openapi({
        description: `Several names to add at once (at most ${MAX_LABELS_PER_REQUEST}). Blanks are dropped, repeats and names that already exist are skipped. A list holds at most ${MAX_OPTIONS_PER_KIND} options.`,
      }),
  })
  .refine(
    (body) => body.label !== undefined || body.labels !== undefined,
    "Provide label or labels",
  );

export const renameOptionBody = z.object({
  label: label.min(1),
});

export const reorderOptionsBody = z.object({
  keys: z.array(z.string().min(1)).max(MAX_OPTIONS_PER_KIND).openapi({
    description:
      "Option keys in the new order. Options not listed keep their relative order after the listed ones.",
  }),
});
