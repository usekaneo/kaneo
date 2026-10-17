import type { providerIssue } from "../../plugins/sync/provider-issue";

type IssueAccess = Awaited<ReturnType<typeof providerIssue>>;

export type ResumeProviderSnapshot = {
  access: IssueAccess;
  remoteIssue: Awaited<ReturnType<IssueAccess["read"]>>;
};
