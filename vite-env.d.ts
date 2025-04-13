/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly KANEO_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
