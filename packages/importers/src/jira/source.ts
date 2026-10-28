import { SourceHttpError } from "../http.js";
import type { ConnectOptions, ImportSource, SourceProject } from "../types.js";
import type { JiraProject } from "./api-types.js";
import { resolveJiraAuth } from "./auth.js";
import { JiraClient } from "./client.js";
import { readJiraProject } from "./read-project.js";
import { parseJiraUrl } from "./url.js";

export type JiraCredentials = {
  url: string;
  email?: string;
  apiToken: string;
};

export const NOT_JIRA_MESSAGE =
  "This address does not look like a Jira site. Check the site URL.";

const PROJECT_TYPES: ReadonlyMap<string, string> = new Map([
  ["software", "Software"],
  ["business", "Business"],
  ["service_desk", "Service management"],
  ["product_discovery", "Product Discovery"],
]);

export async function connectJira(
  credentials: JiraCredentials,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  const site = parseJiraUrl(credentials.url);
  const auth = resolveJiraAuth(site, credentials);
  const client = new JiraClient({
    site,
    auth,
    fetch: options.fetch,
    signal: options.signal,
  });
  await verifyAccount(client);

  return {
    async listProjects(): Promise<SourceProject[]> {
      const projects = await client.listProjects();
      return projects.map((project) => ({
        id: project.key,
        name: project.name,
        detail: projectDetail(project),
      }));
    },

    readProject(projectKey, readOptions) {
      return readJiraProject(
        client.withSignal(readOptions.signal),
        site.baseUrl,
        projectKey,
        readOptions,
      );
    },
  };
}

export function projectDetail(project: JiraProject): string {
  const type = PROJECT_TYPES.get(project.projectTypeKey ?? "");
  return type ? `${project.key} · ${type}` : project.key;
}

async function verifyAccount(client: JiraClient): Promise<void> {
  let user: Awaited<ReturnType<JiraClient["myself"]>>;
  try {
    user = await client.myself();
  } catch (error) {
    if (error instanceof SourceHttpError && error.status === 404) {
      throw new Error(NOT_JIRA_MESSAGE);
    }
    throw error;
  }
  const identified =
    typeof user === "object" &&
    user !== null &&
    Boolean(user.accountId || user.key || user.name || user.displayName);
  if (!identified) throw new Error(NOT_JIRA_MESSAGE);
}
