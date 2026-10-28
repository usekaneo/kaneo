/** The API's stable code for requests to an archived workspace. */
export const WORKSPACE_ARCHIVED_CODE = "WORKSPACE_ARCHIVED";

export function isWorkspaceArchivedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === WORKSPACE_ARCHIVED_CODE
  );
}
