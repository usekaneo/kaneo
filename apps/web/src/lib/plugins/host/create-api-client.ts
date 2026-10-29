import type { ApiClient } from "@kaneo/plugin-sdk/web";
import { parseResponseText, toPluginApiError } from "../plugin-api-error";
import { joinApiUrl } from "../plugin-urls";

type ApiClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };
    const init: RequestInit = { method, headers, credentials: "include" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await (options.fetch ?? fetch)(
      joinApiUrl(options.baseUrl, path),
      init,
    );
    const text = await response.text();
    if (!response.ok) {
      throw toPluginApiError(response.status, response.statusText, text);
    }
    return parseResponseText(text) as T;
  };

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
  };
}
