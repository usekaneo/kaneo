import { resolveApiBaseUrl } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

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
    const error = await HttpError.fromResponse(response);
    throw new HttpError(
      response.status,
      `Failed to fetch instance status: ${error.message}`,
      error,
    );
  }
  return response.json();
}
