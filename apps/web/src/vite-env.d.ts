/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare const __APP_VERSION__: string;

type ImportMetaEnv = {
  readonly KANEO_API_URL: string;
  readonly VITE_SENTRY_DSN?: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};

interface CookieStoreCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  priority?: "Low" | "Medium" | "High";
}

interface CookieStore {
  get(name: string): Promise<CookieStoreCookie | null>;
  getAll(name?: string): Promise<CookieStoreCookie[]>;
  set(cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    priority?: "Low" | "Medium" | "High";
  }): Promise<void>;
  delete(
    name: string,
    options?: { path?: string; domain?: string },
  ): Promise<void>;
}

declare const cookieStore: CookieStore;

interface CookieStoreCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  priority?: "Low" | "Medium" | "High";
}

interface CookieStore {
  get(name: string): Promise<CookieStoreCookie | null>;
  getAll(name?: string): Promise<CookieStoreCookie[]>;
  set(cookie: {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    priority?: "Low" | "Medium" | "High";
  }): Promise<void>;
  delete(
    name: string,
    options?: { path?: string; domain?: string },
  ): Promise<void>;
}
