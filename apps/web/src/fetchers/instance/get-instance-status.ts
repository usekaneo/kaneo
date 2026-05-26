import { resolveApiBaseUrl } from "@kaneo/libs";

export type InstanceStatus = {
  hasUsers: boolean;
  hasAdmin: boolean;
};

export async function getInstanceStatus(): Promise<InstanceStatus> {
  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
  const response = await fetch(`${baseUrl}/instance/status`, {
    credentials: "include",
  });
  if (!response.ok) {
    // Surface the server's error body when available so the UI can
    // distinguish "instance unreachable" from other failures.
    let detail = "";
    try {
      detail = (await response.text()).trim();
    } catch {}
    throw new Error(
      detail
        ? `Failed to fetch instance status (${response.status}): ${detail}`
        : `Failed to fetch instance status (${response.status})`,
    );
  }
  return response.json();
}
