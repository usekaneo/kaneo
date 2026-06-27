import deDE from "./de-DE.json";
import elGR from "./el-GR.json";
import enUS from "./en-US.json";
import esES from "./es-ES.json";
import frFR from "./fr-FR.json";
import koKR from "./ko-KR.json";
import mkMK from "./mk-MK.json";
import nlNL from "./nl-NL.json";
import ruRU from "./ru-RU.json";
import ukUA from "./uk-UA.json";

export const supportedLocales = [
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "fr-FR",
  "ko-KR",
  "mk-MK",
  "nl-NL",
  "ru-RU",
  "uk-UA",
] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en-US";

export const resources = {
  "de-DE": deDE,
  "el-GR": elGR,
  "en-US": enUS,
  "es-ES": esES,
  "fr-FR": frFR,
  "ko-KR": koKR,
  "mk-MK": mkMK,
  "nl-NL": nlNL,
  "ru-RU": ruRU,
  "uk-UA": ukUA,
} as const satisfies Record<AppLocale, typeof enUS>;
