import { treaty } from "@elysiajs/eden";
import type { App } from "@kaneo/api";

export const api = treaty<App>(
  (import.meta.env as ImportMetaEnv).KANEO_API_URL ?? "http://localhost:1337",
  {
    fetch: {
      credentials: "include",
    },
  },
);
