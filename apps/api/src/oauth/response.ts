import { z } from "../openapi";

export const idTokenSchema = z
  .object({
    idToken: z.string().nullable().openapi({
      description:
        "The stored id_token for the user's `custom` OAuth account, or null when they have no such account.",
    }),
  })
  .openapi("OAuthIdToken");
