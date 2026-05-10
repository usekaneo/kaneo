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
    throw new Error("Failed to fetch instance status");
  }
  return response.json();
}
