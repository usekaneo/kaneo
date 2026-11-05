import { z } from "../openapi";
import { tangledRepositoryDidSchema } from "../plugins/tangled/api-contract";

export const tangledProjectConnectionBody = z.object({
  baseUrl: z
    .string()
    .min(1)
    .describe(
      "HTTPS origin of the Tangled read API, for example https://api.tangled.org",
    ),
  repositoryDid: tangledRepositoryDidSchema.describe(
    "Stable repository DID, distinct from the webhook repository identity",
  ),
  repositoryId: z
    .string()
    .min(1)
    .describe(
      "Webhook repository.full_name: owner DID followed by / and the lowercased repository name",
    ),
  repositoryUrl: z.string().min(1),
  branchPattern: z.string().min(1),
  isActive: z.boolean(),
  webhookSecret: z.string().min(1),
});

export const updateTangledProjectConnectionBody = tangledProjectConnectionBody
  .partial()
  .refine(
    (body) => Object.keys(body).length > 0,
    "At least one field is required",
  );

export type TangledProjectConnectionBody = z.infer<
  typeof tangledProjectConnectionBody
>;
export type UpdateTangledProjectConnectionBody = z.infer<
  typeof updateTangledProjectConnectionBody
>;
