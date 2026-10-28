import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const origin = "http://127.0.0.1:5188";
export const api = "http://127.0.0.1:4799";

export async function startWebApp() {
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite-plus/bin/vp",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "5188",
      "--strictPort",
    ],
    {
      cwd: `${root}apps/web`,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...(process.env.TMPDIR && { TMPDIR: process.env.TMPDIR }),
        NODE_ENV: "development",
        VITE_API_URL: api,
        VITE_APP_URL: origin,
        BROWSER: "none",
      },
    },
  );
  let log = "";
  server.stdout.on("data", (chunk) => {
    log += chunk;
  });
  server.stderr.on("data", (chunk) => {
    log += chunk;
  });
  try {
    for (let attempt = 0; ; attempt++) {
      if (server.exitCode !== null || attempt > 60) throw new Error(log);
      if (
        await fetch(origin).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    server.kill("SIGTERM");
    throw error;
  }
  return server;
}

export function fulfillJSON(route, data) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(data),
  });
}
