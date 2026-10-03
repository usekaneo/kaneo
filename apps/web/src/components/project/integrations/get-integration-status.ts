export type IntegrationState = "connected" | "paused" | "disconnected";

export type IntegrationStatus = {
  state: IntegrationState;
  detail?: string;
};

type IntegrationStatusInput = {
  configured: boolean;
  isActive?: boolean | null;
  detail?: string | null;
};

export function getIntegrationStatus({
  configured,
  isActive,
  detail,
}: IntegrationStatusInput): IntegrationStatus {
  if (!configured) return { state: "disconnected" };

  return {
    state: isActive === false ? "paused" : "connected",
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
