import * as v from "valibot";
import { branchPatterns } from "../github/config";
import { tangledRepositoryDidSchema } from "./api-contract";
import { parseTangledApiOrigin } from "./api-url";

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isOrigin(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    parseTangledApiOrigin(value);
    return true;
  } catch {
    return false;
  }
}

function isRepositoryFullName(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const [owner, recordKey, extra] = value.split("/");
  return (
    extra === undefined &&
    tangledRepositoryDidSchema.safeParse(owner).success &&
    typeof recordKey === "string" &&
    /^[A-Za-z0-9._~:-]{1,512}$/.test(recordKey) &&
    recordKey !== "." &&
    recordKey !== ".."
  );
}

export const tangledConfigSchema = v.object({
  repositoryDid: v.pipe(
    v.string(),
    v.custom(
      (value) => tangledRepositoryDidSchema.safeParse(value).success,
      "Must be a repository DID",
    ),
  ),
  origin: v.pipe(
    v.string(),
    v.custom(
      isOrigin,
      "Must be an HTTPS origin without path, query, fragment, or credentials",
    ),
  ),
  repositoryFullName: v.pipe(
    v.string(),
    v.custom(isRepositoryFullName, "Must contain an owner DID and record key"),
  ),
  repositoryUrl: v.pipe(
    v.string(),
    v.custom(isHttpsUrl, "Must be an HTTPS URL without credentials"),
  ),
  branchPattern: v.pipe(v.string(), v.picklist(branchPatterns)),
  webhookSecret: v.pipe(v.string(), v.nonEmpty()),
  active: v.boolean(),
});

export type TangledConfig = v.InferOutput<typeof tangledConfigSchema>;

export async function validateTangledConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  const result = v.safeParse(tangledConfigSchema, config);
  if (result.success) {
    return { valid: true };
  }

  return { valid: false, errors: result.issues.map((issue) => issue.message) };
}
