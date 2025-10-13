/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

interface ImportMetaEnv {
  readonly KANEO_API_URL: string;
  readonly KANEO_ENABLED_AUTH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
