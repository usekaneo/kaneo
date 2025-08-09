import { createHmac, timingSafeEqual } from "node:crypto";
import getGiteaIntegrationByRepository from "../controllers/get-gitea-integration-by-repository";
import { handleIssueWebhook } from "./issue-handlers";

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) {
    return false;
  }

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Gitea sends signature directly as hex (no "sha256=" prefix)
    // Handle both formats for compatibility
    const providedHash = signature.startsWith("sha256=")
      ? signature.replace("sha256=", "")
      : signature;

    return timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedHash, "hex"),
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

type GiteaIssueWebhookPayload = {
  action: "opened" | "closed" | "reopened" | "edited" | "deleted";
  number: number;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    html_url: string;
    user: {
      login: string;
      email?: string;
    };
    created_at: string;
    updated_at: string;
  };
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
};

/**
 * Main webhook processor for Gitea webhooks
 */
export async function processGiteaWebhook(
  eventType: string,
  payload: unknown,
  signature?: string,
  rawBody?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (eventType === "issues") {
      return await handleIssue(
        payload as GiteaIssueWebhookPayload,
        signature,
        rawBody,
      );
    }

    return { success: true, message: `Event type '${eventType}' ignored` };
  } catch (error) {
    console.error("Webhook processing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle issue events (created, updated, closed, etc.)
 */
async function handleIssue(
  payload: GiteaIssueWebhookPayload,
  signature?: string,
  rawBody?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Find the integration for this repository
    const repositoryFullName = payload.repository.full_name;
    const parts = repositoryFullName.split("/");

    if (parts.length !== 2) {
      return {
        success: false,
        error: `Invalid repository format: ${repositoryFullName}`,
      };
    }

    const [repositoryOwner, repositoryName] = parts;

    if (!repositoryOwner || !repositoryName) {
      return {
        success: false,
        error: `Invalid repository parts: ${repositoryFullName}`,
      };
    }

    const integration = await getGiteaIntegrationByRepository(
      repositoryOwner,
      repositoryName,
    );

    if (!integration) {
      return {
        success: false,
        error: `No integration found for repository: ${repositoryFullName}`,
      };
    }

    // Verify webhook signature if secret is configured
    if (integration.webhookSecret && rawBody && signature) {
      const isValid = verifyWebhookSignature(
        rawBody,
        signature,
        integration.webhookSecret,
      );
      if (!isValid) {
        return { success: false, error: "Invalid webhook signature" };
      }
    }

    // Process the issue webhook
    await handleIssueWebhook(payload, integration);

    return { success: true, message: "Issue webhook processed successfully" };
  } catch (error) {
    console.error("Issue webhook handling error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
