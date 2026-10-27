import { ApiError } from "../../errors/api-error";

export const WORKSPACE_ARCHIVED = "WORKSPACE_ARCHIVED";
export const WORKSPACE_ARCHIVED_MESSAGE =
  "This workspace is archived. An instance administrator can restore it.";

export function workspaceArchivedError() {
  return new ApiError(403, {
    code: WORKSPACE_ARCHIVED,
    message: WORKSPACE_ARCHIVED_MESSAGE,
  });
}
