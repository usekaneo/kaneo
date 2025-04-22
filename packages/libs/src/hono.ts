import type { AppType } from "@kaneo/api";
import { hc } from "hono/client";

export const client = hc<AppType>("KANEO_API_URL", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
  },
});
