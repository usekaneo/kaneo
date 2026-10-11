import type { ImportConnectValues } from "@/components/import/connect-values";
import type { ImportSourceId } from "@/components/import/import-source-definitions";
import type { ImportConnection } from "@/fetchers/import/list-import-source-projects";

type BuildConnectionOptions = {
  serverHasTrelloKey: boolean;
};

export function buildConnection(
  source: ImportSourceId,
  values: ImportConnectValues,
  { serverHasTrelloKey }: BuildConnectionOptions,
): ImportConnection | null {
  const url = values.url.trim();
  const apiKey = values.apiKey.trim();
  const token = values.token.trim();
  const username = values.username.trim();

  switch (source) {
    case "linear":
      return apiKey ? { source, apiKey } : null;
    case "trello":
      if (!token) return null;
      if (serverHasTrelloKey) return { source, token };
      return apiKey ? { source, token, apiKey } : null;
    case "plane":
      return url && apiKey ? { source, url, apiKey } : null;
    case "planka":
      if (!url) return null;
      if (values.plankaSignIn === "apiKey") {
        return apiKey ? { source, url, apiKey } : null;
      }
      return username && values.password
        ? { source, url, username, password: values.password }
        : null;
    case "kaneo":
      return url && apiKey ? { source, url, apiKey } : null;
    default:
      return null;
  }
}
