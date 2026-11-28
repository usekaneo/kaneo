import { z } from "zod";

export const tangledRepositoryDidSchema = z
  .string()
  .regex(/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/);

const oidSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i);
const branchNameSchema = z
  .string()
  .min(1)
  .refine((name) =>
    [...name].every(
      (character) =>
        character.charCodeAt(0) > 32 &&
        character.charCodeAt(0) !== 127 &&
        character !== "\\",
    ),
  );

export const tangledRefSchema = z.object({
  name: z
    .string()
    .startsWith("refs/heads/")
    .refine(
      (ref) =>
        branchNameSchema.safeParse(ref.slice("refs/heads/".length)).success,
    ),
  oid: oidSchema,
});

export const tangledBranchesSchema = z
  .object({
    branches: z
      .array(z.object({ name: branchNameSchema, oid: oidSchema }))
      .max(100),
    total: z.number().int().nonnegative().safe(),
    cursor: z.string().min(1).optional(),
  })
  .superRefine((page, context) => {
    if (page.total < page.branches.length) {
      context.addIssue({
        code: "custom",
        message: "Branch total is smaller than the page",
      });
    }
    if (
      new Set(page.branches.map((branch) => branch.name)).size !==
      page.branches.length
    ) {
      context.addIssue({ code: "custom", message: "Duplicate branch in page" });
    }
  });

export const tangledRepositorySchema = z.object({
  uri: z
    .string()
    .regex(
      /^at:\/\/did:[a-z0-9]+:[A-Za-z0-9._:%-]+\/org\.tangled\.repo\.manifest\/self$/,
    ),
  value: z.object({
    $type: z.literal("org.tangled.repo.manifest"),
    declaration: z.object({
      owner: tangledRepositoryDidSchema,
      name: z
        .string()
        .regex(/^[A-Za-z0-9._~:-]{1,512}$/)
        .refine((name) => name !== "." && name !== ".."),
    }),
  }),
});

export type TangledRef = z.infer<typeof tangledRefSchema>;
export type TangledBranchPage = z.infer<typeof tangledBranchesSchema>;
export type TangledRepository = z.infer<typeof tangledRepositorySchema>;
