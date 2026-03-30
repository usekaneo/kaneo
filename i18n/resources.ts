import deDE from "./de-DE.json";
import elGR from "./el-GR.json";
import enUS from "./en-US.json";
import frFR from "./fr-FR.json";
import mkMK from "./mk-MK.json";

export const supportedLocales = [
  "en-US",
  "de-DE",
  "el-GR",
  "mk-MK",
  "fr-FR",
] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "en-US": enUS,
  "de-DE": deDE,
  "el-GR": elGR,
  "mk-MK": mkMK,
  "fr-FR": frFR,
} as const;
