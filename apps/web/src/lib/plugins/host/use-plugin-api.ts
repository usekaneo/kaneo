import { windowId } from "@kaneo/libs";
import type { ApiClient } from "@kaneo/plugin-sdk/web";
import { useMemo } from "react";
import { apiBaseUrl } from "../plugin-urls";
import { createApiClient } from "./create-api-client";
import { usePluginScope } from "./plugin-scope-context";

const headers = { "X-Kaneo-Window-Id": windowId };

export function usePluginApi(): ApiClient {
  const { id } = usePluginScope();
  return useMemo(
    () =>
      createApiClient({
        baseUrl: `${apiBaseUrl()}/plugins/${encodeURIComponent(id)}`,
        headers,
      }),
    [id],
  );
}

export function useKaneoApi(): ApiClient {
  return useMemo(() => createApiClient({ baseUrl: apiBaseUrl(), headers }), []);
}
