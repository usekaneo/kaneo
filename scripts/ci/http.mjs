import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

export const password = "CI-only-password-937!";
export function localOrigin(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "http:");
  assert.equal(
    url.hostname,
    "127.0.0.1",
    "Tests must use disposable loopback services",
  );
  assert.equal(url.pathname, "/");
  return url.origin;
}
export async function ready(origin) {
  localOrigin(origin);
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`${origin}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok && (await response.json()).status === "ok") return;
    } catch {}
    await setTimeout(1000);
  }
  throw new Error(`API did not become healthy at ${origin}`);
}
export class Client {
  constructor(origin) {
    this.origin = localOrigin(origin);
    this.cookies = new Map();
  }
  get cookie() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
  async response(path, { method = "GET", body } = {}) {
    assert.ok(path.startsWith("/api/"));
    const response = await fetch(`${this.origin}${path}`, {
      method,
      headers: {
        Origin: this.origin,
        Cookie: this.cookie,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const at = pair.indexOf("=");
      this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  }
  async json(path, method = "GET", body = undefined) {
    const response = await this.response(path, { method, body });
    assert.ok(
      response.ok,
      `${method} ${path}: ${response.status} ${await response.clone().text()}`,
    );
    return response.json();
  }
  async signup(label) {
    this.email = `ci-${label}-${randomUUID()}@example.com`;
    return this.json("/api/auth/sign-up/email", "POST", {
      name: `CI ${label}`,
      email: this.email,
      password,
    });
  }
  async signin(email) {
    return this.json("/api/auth/sign-in/email", "POST", { email, password });
  }
}
export async function seed(origin, label) {
  const client = new Client(origin);
  const account = await client.signup(label);
  const workspace = await client.json("/api/auth/organization/create", "POST", {
    name: `CI ${label}`,
    slug: `ci-${randomUUID()}`,
  });
  const project = await client.json("/api/project", "POST", {
    name: `CI ${label}`,
    workspaceId: workspace.id,
    icon: "Folder",
    slug: "CI",
  });
  const task = await client.json(`/api/task/${project.id}`, "POST", {
    title: `CI ${label} task`,
    description: "Upgrade and realtime fixture",
    priority: "medium",
    status: "to-do",
  });
  return { client, account, workspace, project, task };
}
