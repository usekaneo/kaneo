import type { getAdminAgentSettings } from "@/fetchers/admin-agent/get-model-settings";

export type AdminAgentSettings = Awaited<
  ReturnType<typeof getAdminAgentSettings>
>;
export type ModelChoice = { id: string; label: string };
