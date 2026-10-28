import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { publishEvent } from "../../events";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { withSyncLease } from "../../plugins/sync/lease";
import { SyncLeaseBusyError } from "../../plugins/sync/lease-busy-error";
import { publishTaskMutation } from "../../task/controllers/task-mutation-effects";
import { applySyncResume } from "./apply-resume";
import { lockResumeScope } from "./lock-resume-scope";
import { reviewSyncResume } from "./review-resume";
import { verifyResumeProvider } from "./verify-resume-provider";
import type { ResumeProviderSnapshot } from "./resume-provider-snapshot";

export async function resumeSync(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
  authorizedWorkspaceId: string,
) {
  try {
    return await withSyncLease(`sync-resume:${linkId}`, () =>
      resumeWithLease(
        projectId,
        provider,
        linkId,
        token,
        source,
        authorizedWorkspaceId,
      ),
    );
  } catch (error) {
    if (error instanceof SyncLeaseBusyError)
      throw new HTTPException(409, { message: error.message });
    throw error;
  }
}

async function resumeWithLease(
  projectId: string,
  provider: string,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
  authorizedWorkspaceId: string,
) {
  // Provider latency must not retain a pooled connection or block local edits.
  const initial = await reviewSyncResume(
    projectId,
    provider,
    linkId,
    authorizedWorkspaceId,
  );
  const { snapshot } = initial;
  let request:
    | Promise<
        | {
            value: Awaited<
              ReturnType<ResumeProviderSnapshot["access"]["write"]>
            >;
          }
        | { error: unknown }
      >
    | undefined;
  let providerWritten = false;
  let updatedAt: string | null = null;
  let adoption: Awaited<ReturnType<typeof applySyncResume>>;
  const validate = async (tx: Parameters<typeof lockResumeScope>[4]) => {
    await lockResumeScope(
      projectId,
      provider,
      linkId,
      authorizedWorkspaceId,
      tx,
    );
    const review = await reviewSyncResume(
      projectId,
      provider,
      linkId,
      authorizedWorkspaceId,
      tx,
      snapshot,
    );
    if (review.token !== token)
      throw new HTTPException(409, {
        message: "Task or issue changed; review the comparison again",
      });
    return review;
  };
  try {
    if (source === "kaneo") {
      await db.transaction(async (tx) => {
        const review = await validate(tx);
        // Dispatch while scope changes are excluded, then release the locks
        // before awaiting the response. Completion rechecks the local snapshot.
        request = snapshot.access.write(review.local).then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
      });
      const result = await request!;
      if ("error" in result) {
        console.error("Sync resume provider write failed", {
          projectId,
          provider,
          linkId,
        });
        throw new HTTPException(502, {
          message: "External issue could not be updated; sync remains paused",
        });
      }
      providerWritten = true;
      updatedAt = result.value.updatedAt;
    }
    await db.transaction(async (tx) => {
      const review = await validate(tx);
      adoption = await applySyncResume(review, provider, source, updatedAt, tx);
    });
  } catch (error) {
    // Dispatch can outlive a failed scope transaction. Observe its result before
    // deciding whether the next comparison must show an uncertain provider edit.
    if (request && !providerWritten)
      providerWritten = "value" in (await request);
    if (providerWritten) {
      await updateExternalLink(linkId, {
        metadata: { syncFilterPaused: true, syncResumeUncertain: true },
      });
      await publishEvent("project.updated", { projectId });
      await publishEvent("task.updated", {
        projectId,
        taskId: initial.task.id,
      });
    }
    throw error;
  }
  let verificationError: unknown;
  // An issue edit's only webhook may have been discarded while paused, in either
  // resume direction. Read after unpausing so later webhooks can also run.
  try {
    await verifyResumeProvider(
      snapshot,
      source === "kaneo" ? initial.local : initial.remote,
    );
  } catch (error) {
    verificationError = error;
    console.error("Sync resume provider verification failed", {
      projectId,
      provider,
      linkId,
    });
    await updateExternalLink(linkId, {
      metadata: { syncFilterPaused: true },
    });
  }
  if (adoption)
    await publishTaskMutation(adoption.before, adoption.after, undefined, {
      fields: ["title", "description", "status"],
      sourceIntegrationId: adoption.integrationId,
    });
  await publishEvent("task.updated", { projectId, taskId: initial.task.id });
  await publishEvent("project.updated", { projectId });
  if (verificationError) throw verificationError;
  return { success: true };
}
