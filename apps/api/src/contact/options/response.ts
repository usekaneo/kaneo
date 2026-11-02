import { z } from "../../openapi";

export const contactOptionSchema = z
  .object({
    key: z.string().openapi({
      description:
        "Stable identifier stored on contacts. It never changes when the label is renamed.",
    }),
    label: z.string(),
    position: z.number().int(),
    contactCount: z.number().int().openapi({
      description: "Number of contacts currently using this option.",
    }),
  })
  .openapi("ContactOption");

export const contactOptionsSchema = z
  .object({
    types: z.array(contactOptionSchema),
    regions: z.array(contactOptionSchema),
  })
  .openapi("ContactOptions");

export const createOptionsResultSchema = z
  .object({
    created: z.array(contactOptionSchema),
    skipped: z.array(z.string()).openapi({
      description:
        "Names not added because they already exist or were repeated in the request.",
    }),
  })
  .openapi("CreateContactOptionsResult");

export const deleteOptionResultSchema = z
  .object({
    key: z.string(),
    affectedContacts: z.number().int().openapi({
      description: "Contacts that had this option and now have none.",
    }),
  })
  .openapi("DeleteContactOptionResult");
