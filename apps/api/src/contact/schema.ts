import { z } from "../openapi";
import { CONTACT_REGIONS, CONTACT_TYPES } from "./options";

export const workspaceParam = z.object({ workspaceId: z.string() });
export const contactParam = z.object({ id: z.string() });

export const listContactsQuery = z.object({
  search: z.string().trim().max(120).optional().openapi({
    description: "Match against name, phone, or email (case-insensitive).",
  }),
  type: z.enum(CONTACT_TYPES).optional(),
  region: z.enum(CONTACT_REGIONS).optional(),
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
  type: z.enum(CONTACT_TYPES).describe("What kind of contact this is"),
  region: z.enum(CONTACT_REGIONS).describe("Where the contact operates"),
  notes: optionalText(2000, "Free-form notes"),
};

export const createContactBody = z.object({
  name: fields.name,
  phone: fields.phone.optional(),
  email: fields.email.optional(),
  type: fields.type.default("other"),
  region: fields.region.default("other"),
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
