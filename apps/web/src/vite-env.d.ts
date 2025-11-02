/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly KANEO_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
