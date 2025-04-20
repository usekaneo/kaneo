import type { AppType } from "@kaneo/api";
import { hc } from "hono/client";

export const client = hc<AppType>(
  import.meta.env.VITE_API_URL ?? "http://localhost:1337",
  {
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
  },
);
