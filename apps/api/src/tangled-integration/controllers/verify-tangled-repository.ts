import { HTTPException } from "hono/http-exception";
import type { TangledConfig } from "../../plugins/tangled/config";
import { createTangledReadClient } from "../../plugins/tangled/read-client";

export async function verifyTangledRepository(
  config: Pick<
    TangledConfig,
    "origin" | "repositoryDid" | "repositoryFullName"
  >,
): Promise<void> {
  let repositoryFullName: string;
  try {
    repositoryFullName = (await createTangledReadClient(config).getRepository())
      .webhookRepositoryFullName;
  } catch {
    throw new HTTPException(502, {
      message:
        "Cannot verify Tangled repository. Check the read API origin and repository DID, then retry.",
    });
  }
  if (repositoryFullName !== config.repositoryFullName) {
    throw new HTTPException(400, {
      message:
        "Webhook repository identity does not match the configured Tangled repository DID.",
    });
  }
}
