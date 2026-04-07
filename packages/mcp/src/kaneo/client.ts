import type { AuthService } from "../auth/auth-service.js";

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export class KaneoClient {
  readonly baseUrl: string;
  private readonly auth: AuthService;

  constructor(options: { baseUrl: string; auth: AuthService }) {
    this.baseUrl = options.baseUrl;
    this.auth = options.auth;
  }

  private async authorizedFetch(
    path: string,
    init?: RequestInit,
    didRetry = false,
  ): Promise<Response> {
    const token = await this.auth.getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const timeoutSignal = AbortSignal.timeout(10_000);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    const res = await fetch(url, { ...init, headers, signal });

    if (res.status === 401 && !didRetry) {
      await this.auth.clearToken();
      return this.authorizedFetch(path, init, true);
    }

    return res;
  }

  async json<T = Json>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.authorizedFetch(path, init);
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      let detail: string;
      if (
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
      ) {
        detail = (body as { message: string }).message;
      } else if (typeof body === "string" && body.length > 0) {
        detail = body.length > 500 ? `${body.slice(0, 500)}…` : body;
      } else {
        detail = `HTTP ${res.status}`;
      }
      throw new Error(`${path}: ${detail}`);
    }
    return body as T;
  }
}
