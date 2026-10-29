import type { getAdminOverview } from "./get-admin-overview";

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
