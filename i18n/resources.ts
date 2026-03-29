import deDE from "./de-DE.json";
import enUS from "./en-US.json";
import elGR from "./el-GR.json";

export const supportedLocales = ["en-US", "de-DE", "el-GR"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "en-US": enUS,
  "de-DE": deDE,
  "el-GR": elGR,
} as const;
