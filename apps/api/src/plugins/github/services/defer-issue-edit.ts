import { issueEditScope, type IssueField } from "../utils/deferred-issue-edit";
import { updateExternalLink } from "./link-manager";
import { withIntegrationLink } from "./with-integration-link";
type Integration = {
  id: string;
  projectId: string;
  type: string;
  config: string;
};
// Commit the intent before acknowledging a delivery which cannot wait for its writer.
export async function deferIssueEdit(
  link: { id: string; taskId: string },
  integration: Integration,
  fields: IssueField[],
) {
  await withIntegrationLink(
    link,
    integration,
    async (tx) => {
      await updateExternalLink(
        link.id,
        { deferredEdit: { fields, scope: issueEditScope(integration) } },
        tx,
      );
    },
    {
      validate: (binding) =>
        issueEditScope(binding) === issueEditScope(integration),
    },
  );
}

// Coalesce remaining local corrections by link and field without storing task text.
export async function deferTaskSync(
  link: { id: string; taskId: string },
  integration: Integration,
  fields: IssueField[],
) {
  await withIntegrationLink(
    link,
    integration,
    async (tx) => {
      await updateExternalLink(
        link.id,
        {
          deferredEdit: {
            fields: [],
            repairFields: fields,
            scope: issueEditScope(integration),
          },
        },
        tx,
      );
    },
    integration,
  );
}
