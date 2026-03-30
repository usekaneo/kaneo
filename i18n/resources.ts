import deDE from "./de-DE.json";
import elGR from "./el-GR.json";
import enUS from "./en-US.json";
import frFR from "./fr-FR.json";
import mkMK from "./mk-MK.json";

export const supportedLocales = [
  "mk-MK",
  "en-US",
  "de-DE",
  "el-GR",
  "fr-FR",
] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "mk-MK": mkMK,
  "en-US": enUS,
  "de-DE": deDE,
  "el-GR": elGR,
  "fr-FR": frFR,
} as const;
