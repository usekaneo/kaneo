import { withSyncLease } from "./lease";
import { SyncLeaseBusyError } from "./lease-busy-error";
import { providerIssue } from "./provider-issue";

/**
 * Label webhooks carry a snapshot that can predate Kaneo's latest label write,
 * so applying it echoes an old status back. Runs `apply` with the issue's
 * current labels under the lease that outbound field-label sync holds while it
 * rewrites them. `labels` is undefined when that sync stays busy: it is
 * writing a newer Kaneo value over them.
 */
export async function withCurrentIssueLabels<T>(
  integration: { type: string; config: string },
  link: { id: string; externalId: string; taskId: string },
  apply: (labels: string[] | undefined) => Promise<T>,
): Promise<T> {
  let claimed = false;
  try {
    return await withSyncLease(`sync-field-labels:${link.id}`, async () => {
      claimed = true;
      return apply(
        (await (await providerIssue(integration, link)).read()).labels,
      );
    });
  } catch (error) {
    if (claimed || !(error instanceof SyncLeaseBusyError)) throw error;
  }
  return apply(undefined);
}
