import { sessionStore, type Session } from "../session";

export const CLOUD_URL = "https://cloud.kaneo.app";

/** Device-authorization client accepted by default Kaneo instances (shared with the official CLI). */
export const DEVICE_CLIENT_ID = "kaneo-cli";

export class ApiError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Normalizes what a person typed into an instance origin: adds a scheme, drops a trailing
 * slash and a trailing `/api`, so both `kaneo.example.com` and `https://kaneo.example.com/api` work.
 */
export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url.endsWith("/api")) url = url.slice(0, -4);
  return url.replace(/\/+$/, "");
}

/** Resolves a possibly relative asset path (e.g. `/api/asset/...`) against the instance. */
export function resolveUrl(
  serverUrl: string,
  path?: string | null,
): string | null {
  if (!path) return null;
  if (/^(https?:|data:)/.test(path)) return path;
  return `${serverUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function credentialHeaders(
  session: Pick<Session, "credentialType" | "token">,
): Record<string, string> {
  return session.credentialType === "apiKey"
    ? { "x-api-key": session.token }
    : { Authorization: `Bearer ${session.token}` };
}

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();
export function onSessionExpired(listener: ExpiredListener) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: string;
  query?: Query;
  body?: unknown;
  /** Explicit server and credentials, used while signing in before a session exists. */
  serverUrl?: string;
  credentials?: Pick<Session, "credentialType" | "token">;
  /** Return the raw Response instead of parsing JSON (for header access). */
  raw?: boolean;
  /**
   * Kaneo's validators mostly treat absent fields as "leave unset" and reject `null`, so null
   * properties are dropped by default. A few routes need an explicit null (unassign, clear avatar).
   */
  keepNulls?: boolean;
};

function buildUrl(base: string, path: string, query?: Query) {
  const url = `${base}/${path.replace(/^\/+/, "")}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    );
  return params.length ? `${url}?${params.join("&")}` : url;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== "object")
    return typeof body === "string" && body.length < 200 ? body : null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (
    obj.error &&
    typeof obj.error === "object" &&
    typeof (obj.error as Record<string, unknown>).message === "string"
  ) {
    return (obj.error as Record<string, string>).message;
  }
  if (typeof obj.error === "string") return obj.error;
  return null;
}

function httpMessage(status: number, body: unknown): string {
  const message = messageFrom(body);
  if (message) return message;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 429) return "Too many requests. Please wait a moment.";
  if (status >= 500) return `The server had a problem (${status}).`;
  return `Request failed (${status}).`;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const session = sessionStore.get().session;
  const serverUrl = options.serverUrl ?? session?.serverUrl;
  if (!serverUrl) throw new ApiError("Not signed in");
  const creds =
    options.credentials ??
    (session && serverUrl === session.serverUrl ? session : null);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (creds) Object.assign(headers, credentialHeaders(creds));
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = options.keepNulls
      ? JSON.stringify(options.body)
      : JSON.stringify(options.body, (_, v: unknown) =>
          v === null ? undefined : v,
        );
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(serverUrl, path, options.query), {
      method: options.method ?? "GET",
      headers,
      body,
      credentials: "omit",
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Check your connection and the server address.",
    );
  }

  if (options.raw) return response as unknown as T;

  const parsed = await readBody(response);
  if (!response.ok) {
    if (
      response.status === 401 &&
      session &&
      !path.startsWith("api/auth/") &&
      !options.credentials
    ) {
      expiredListeners.forEach((l) => l());
    }
    throw new ApiError(
      httpMessage(response.status, parsed),
      response.status,
      parsed,
    );
  }
  return parsed as T;
}

/** Turns any failure into a message fit to show a person. */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message || "Something went wrong";
  return "Something went wrong";
}

export { httpMessage };
