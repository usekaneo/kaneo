import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string() });
export const contactParam = z.object({ id: z.string() });

const optionFilter = (what: string) =>
  z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || undefined)
    .optional()
    .openapi({
      description: `Only contacts with this ${what}, given as its key or label (case-insensitive).`,
    });

export const listContactsQuery = z.object({
  search: z.string().trim().max(120).optional().openapi({
    description: "Match against name, phone, or email (case-insensitive).",
  }),
  type: optionFilter("contact type"),
  region: optionFilter("location"),
});

const optionalText = (max: number, description: string) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .describe(`${description}; empty clears it`);

const fields = {
  name: z.string().trim().min(1).max(120).describe("Person or company name"),
  phone: optionalText(40, "Phone number"),
  email: optionalText(254, "Email address"),
  type: optionalText(
    120,
    "Contact type, as an option key or label (see the options routes)",
  ),
  region: optionalText(
    120,
    "Location, as an option key or label (see the options routes)",
  ),
  notes: optionalText(2000, "Free-form notes"),
};

export const createContactBody = z.object({
  name: fields.name,
  phone: fields.phone.optional(),
  email: fields.email.optional(),
  type: fields.type.optional(),
  region: fields.region.optional(),
  notes: fields.notes.optional(),
});

export const updateContactBody = z
  .object({
    name: fields.name.optional(),
    phone: fields.phone.optional(),
    email: fields.email.optional(),
    type: fields.type.optional(),
    region: fields.region.optional(),
    notes: fields.notes.optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    "Provide at least one field to update",
  );
