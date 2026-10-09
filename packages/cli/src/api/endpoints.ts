import { Effect } from "effect";
import type { Credentials } from "../services/session.js";
import { fromOrganizations } from "./from-organizations.js";
import { KaneoApi, type Query } from "./kaneo-api.js";
import {
  AssignedTasks,
  BoardPage,
  ColumnList,
  CurrentUser,
  OrganizationList,
  Project,
  ProjectList,
  Workspace,
  WorkspaceList,
  WorkspaceMemberList,
} from "./schemas.js";

export const getCurrentUser = Effect.fnUntraced(function* (
  credentials?: Credentials,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/user/me", CurrentUser, {
    credentials,
  });
});

export const listWorkspaces = Effect.fnUntraced(function* (
  credentials?: Credentials,
) {
  const api = yield* KaneoApi;
  return yield* api
    .request("GET", "/api/workspace", WorkspaceList, { credentials })
    .pipe(
      Effect.catchTag("NotFound", () =>
        api
          .request("GET", "/api/auth/organization/list", OrganizationList, {
            credentials,
          })
          .pipe(Effect.map(fromOrganizations)),
      ),
    );
});

export const getWorkspace = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  return yield* api
    .request(
      "GET",
      `/api/workspace/${encodeURIComponent(workspaceId)}`,
      Workspace,
    )
    .pipe(
      Effect.catchTag("NotFound", (notFound) =>
        api
          .request("GET", "/api/auth/organization/list", OrganizationList)
          .pipe(
            Effect.map(fromOrganizations),
            Effect.flatMap((workspaces) => {
              const match = workspaces.find(
                (workspace) => workspace.id === workspaceId,
              );
              return match ? Effect.succeed(match) : Effect.fail(notFound);
            }),
          ),
      ),
    );
});

export const listProjects = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/project", ProjectList, {
    query: { workspaceId },
  });
});

export const getBoardPage = Effect.fnUntraced(function* (
  projectId: string,
  query: Query,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/task/tasks/${encodeURIComponent(projectId)}`,
    BoardPage,
    { query },
  );
});

export const listAssignedTasks = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/task/assigned", AssignedTasks, {
    query: { workspaceId },
  });
});

export const getProject = Effect.fnUntraced(function* (projectId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/project/${encodeURIComponent(projectId)}`,
    Project,
  );
});

export const listColumns = Effect.fnUntraced(function* (projectId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/column/${encodeURIComponent(projectId)}`,
    ColumnList,
  );
});

export const listMembers = Effect.fnUntraced(function* (workspaceId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/workspace/${encodeURIComponent(workspaceId)}/members`,
    WorkspaceMemberList,
  );
});
