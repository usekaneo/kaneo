import deDE from "./de-DE.json";
import elGR from "./el-GR.json";
import enUS from "./en-US.json";
import esES from "./es-ES.json";
import frFR from "./fr-FR.json";
import mkMK from "./mk-MK.json";
import nlNL from "./nl-NL.json";

export const supportedLocales = [
  "mk-MK",
  "nl-NL",
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "fr-FR",
] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "mk-MK": mkMK,
  "nl-NL": nlNL,
  "en-US": enUS,
  "de-DE": deDE,
  "el-GR": elGR,
  "fr-FR": frFR,
  "es-ES": esES,
} as const;
