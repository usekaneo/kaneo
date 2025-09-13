import type { authClient } from "@/lib/auth-client";

export type Workspace = NonNullable<
  Awaited<
    ReturnType<typeof authClient.organization.getFullOrganization>
  >["data"]
>;

export type ActiveWorkspace = NonNullable<
  ReturnType<typeof authClient.useActiveOrganization>["data"]
>;

export default Workspace;
