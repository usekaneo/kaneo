/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare const __APP_VERSION__: string;

type ImportMetaEnv = {
  readonly KANEO_API_URL: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
