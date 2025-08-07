import { eq } from "drizzle-orm";
import db from "../../database";
import { giteaIntegrationTable } from "../../database/schema";

export interface GiteaClient {
  url: string;
  token?: string;
  owner: string;
  repo: string;
}

export async function createGiteaClient(
  projectId: string,
): Promise<GiteaClient | null> {
  const integration = await db.query.giteaIntegrationTable.findFirst({
    where: eq(giteaIntegrationTable.projectId, projectId),
  });

  if (!integration || !integration.isActive) {
    return null;
  }

  return {
    url: integration.giteaUrl,
    token: integration.accessToken || undefined,
    owner: integration.repositoryOwner,
    repo: integration.repositoryName,
  };
}

export async function makeGiteaRequest(
  client: GiteaClient,
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = new URL(endpoint, `${client.url}/api/v1/`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (client.token) {
    headers.Authorization = `token ${client.token}`;
  }

  return fetch(url.toString(), {
    ...options,
    headers,
  });
}

export async function giteaApiCall<T>(
  client: GiteaClient,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await makeGiteaRequest(client, endpoint, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gitea API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return response.json() as T;
}
