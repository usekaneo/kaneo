import { createApp } from "../../../../apps/api/src/index";

export function projectAccessApi(headers: Record<string, string> = {}) {
  const { app } = createApp();
  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
}
