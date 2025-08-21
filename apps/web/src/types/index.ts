import type { authClient } from "@/lib/auth-client";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/src/routers";

export type Session = typeof authClient.$Infer.Session;
export type Member = typeof authClient.$Infer.Member;

// Base tRPC types
type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

// Task types
export type Task = RouterOutputs["task"]["get"];
export type TaskList = RouterOutputs["task"]["list"];
export type CreateTaskInput = RouterInputs["task"]["create"];
export type UpdateTaskInput = RouterInputs["task"]["update"];
export type DeleteTaskInput = RouterInputs["task"]["delete"];
export type ExportTasksInput = RouterInputs["task"]["export"];
export type ImportTasksInput = RouterInputs["task"]["import"];
export type TaskToImport = ImportTasksInput["tasks"][number];

// Project types
export type Project = RouterOutputs["project"]["get"];
export type ProjectList = RouterOutputs["project"]["list"];
export type CreateProjectInput = RouterInputs["project"]["create"];
export type UpdateProjectInput = RouterInputs["project"]["update"];
export type DeleteProjectInput = RouterInputs["project"]["delete"];

// Project column type
export type ProjectColumn = Project["columns"][number];

// Activity types
export type Activity = RouterOutputs["activity"]["getByTaskId"][number];
export type CreateActivityInput = RouterInputs["activity"]["create"];
export type CreateCommentInput = RouterInputs["activity"]["createComment"];
export type UpdateCommentInput = RouterInputs["activity"]["updateComment"];
export type DeleteCommentInput = RouterInputs["activity"]["deleteComment"];

// Label types
export type Label = RouterOutputs["label"]["get"];
export type LabelList = RouterOutputs["label"]["getByTaskId"];
export type CreateLabelInput = RouterInputs["label"]["create"];
export type UpdateLabelInput = RouterInputs["label"]["update"];
export type DeleteLabelInput = RouterInputs["label"]["delete"];

// Time Entry types
export type TimeEntry = RouterOutputs["timeEntry"]["get"];
export type TimeEntryList = RouterOutputs["timeEntry"]["getByTaskId"];
export type CreateTimeEntryInput = RouterInputs["timeEntry"]["create"];
export type UpdateTimeEntryInput = RouterInputs["timeEntry"]["update"];

// Notification types
export type Notification = RouterOutputs["notification"]["list"][number];
export type NotificationList = RouterOutputs["notification"]["list"];
export type CreateNotificationInput = RouterInputs["notification"]["create"];
export type MarkAsReadInput = RouterInputs["notification"]["markAsRead"];
export type UnreadCount = RouterOutputs["notification"]["getUnreadCount"];

// GitHub Integration types
export type GitHubIntegration = RouterOutputs["githubIntegration"]["get"];
export type GitHubRepositoryList =
  RouterOutputs["githubIntegration"]["listRepositories"];
export type CreateGitHubIntegrationInput =
  RouterInputs["githubIntegration"]["create"];
export type DeleteGitHubIntegrationInput =
  RouterInputs["githubIntegration"]["delete"];
export type VerifyInstallationInput =
  RouterInputs["githubIntegration"]["verifyInstallation"];
export type ImportIssuesInput =
  RouterInputs["githubIntegration"]["importIssues"];
export type GitHubAppInfo = RouterOutputs["githubIntegration"]["getAppInfo"];

// Search types
export type SearchResults = RouterOutputs["search"]["global"];
export type SearchInput = RouterInputs["search"]["global"];

// Config types
export type AppConfig = RouterOutputs["config"];

// Workspace types (inferred from authClient.organization methods)
export type Workspace = Awaited<
  ReturnType<typeof authClient.organization.list>
>["data"][number];

export type WorkspaceList = Awaited<
  ReturnType<typeof authClient.organization.list>
>["data"];

export type CreateWorkspaceInput = Parameters<
  typeof authClient.organization.create
>[0];

export type UpdateWorkspaceInput = Parameters<
  typeof authClient.organization.update
>[0];

export type DeleteWorkspaceInput = Parameters<
  typeof authClient.organization.delete
>[0];

// Workspace User types (inferred from authClient.organization.listMembers)
export type WorkspaceUser = Awaited<
  ReturnType<typeof authClient.organization.listMembers>
>["data"][number];

export type WorkspaceUserList = Awaited<
  ReturnType<typeof authClient.organization.listMembers>
>["data"];

export type InviteWorkspaceMemberInput = Parameters<
  typeof authClient.organization.inviteMember
>[0];

export type DeleteWorkspaceUserInput = Parameters<
  typeof authClient.organization.removeMember
>[0];

export type GetWorkspaceUsersInput = Parameters<
  typeof authClient.organization.listMembers
>[0];

export type GetActiveWorkspaceUsersInput = Parameters<
  typeof authClient.organization.listMembers
>[0];
