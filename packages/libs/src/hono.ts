/// <reference types="vite/types/importMeta.d.ts" />

import type { AppType } from "@kaneo/api";
import { hc } from "hono/client";

export const client = hc<AppType>(
  import.meta.env.VITE_API_URL || "http://andrej.cxom:1337",
  {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          "Content-Type": "application/json",
        },
        credentials: "include",
      }).catch((error) => {
        if (error instanceof TypeError && error.message.includes("fetch")) {
          const apiUrl =
            import.meta.env.VITE_API_URL || "http://localhost:1337";
          throw new Error(
            `Failed to connect to API server at ${apiUrl}. This might be due to CORS configuration issues or the server not running. Please check your environment variables and server status.`,
          );
        }
        throw error;
      });
    },
  },
);
