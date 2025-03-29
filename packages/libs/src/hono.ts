import type { AppType } from "@kaneo/hono-api";
import { hc } from "hono/client";

export const client = hc<AppType>(
  import.meta.env.VITE_API_URL ?? "http://localhost:1336",
  {
    headers: {
      "Content-Type": "application/json",
    },
  },
);
