import enUS from "./en-US.json";
import deDE from "./de-DE.json";

export const supportedLocales = ["en-US", "de-DE"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "en-US": enUS,
  "de-DE": deDE,
} as const;
