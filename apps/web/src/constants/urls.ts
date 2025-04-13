export const API_URL: string =
  (import.meta.env as ImportMetaEnv).KANEO_API_URL ?? "http://localhost:1337";

export const isDemoMode = window.location.hostname === "demo.kaneo.app";
