export const SHARED_MODULES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "@tanstack/react-query",
] as const;

export type SharedModule = (typeof SHARED_MODULES)[number];

export const SHARED_MODULES_GLOBAL = "__KANEO_SHARED_MODULES__";

export const PLUGIN_HOST_GLOBAL = "__KANEO_PLUGIN_HOST__";
