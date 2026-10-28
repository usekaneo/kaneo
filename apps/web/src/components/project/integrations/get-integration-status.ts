export type IntegrationState =
  | "connected"
  | "paused"
  | "disconnected"
  | "loading"
  | "unavailable";

export type IntegrationStatus = {
  state: IntegrationState;
  detail?: string;
};

type IntegrationStatusInput = {
  hasData?: boolean;
  queryStatus?: "pending" | "error" | "success";
  configured: boolean;
  isActive?: boolean | null;
  detail?: string | null;
};

export function getIntegrationStatus({
  queryStatus = "success",
  hasData = queryStatus === "success",
  configured,
  isActive,
  detail,
}: IntegrationStatusInput): IntegrationStatus {
  if (!hasData && queryStatus === "pending") return { state: "loading" };
  if (!hasData && queryStatus === "error") return { state: "unavailable" };
  if (!configured) return { state: "disconnected" };

  return {
    state: isActive === true ? "connected" : "paused",
    detail: detail?.trim() || undefined,
  };
}

export function formatRepository(
  owner: string | null | undefined,
  name: string | null | undefined,
) {
  return owner && name ? `${owner}/${name}` : undefined;
}

export function formatChannel(channel: string | null | undefined) {
  const trimmed = channel?.trim().replace(/^#/, "");
  return trimmed ? `#${trimmed}` : undefined;
}
