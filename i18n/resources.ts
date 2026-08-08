import deDE from "./de-DE.json";
import elGR from "./el-GR.json";
import enUS from "./en-US.json";
import esES from "./es-ES.json";
import frFR from "./fr-FR.json";
import hiIN from "./hi-IN.json";
import idID from "./id-ID.json";
import itIT from "./it-IT.json";
import koKR from "./ko-KR.json";
import mkMK from "./mk-MK.json";
import nlNL from "./nl-NL.json";
import ptBR from "./pt-BR.json";
import ruRU from "./ru-RU.json";
import trTR from "./tr-TR.json";
import ukUA from "./uk-UA.json";
import viVN from "./vi-VN.json";
import zhCN from "./zh-CN.json";

export const supportedLocales = [
  "mk-MK",
  "nl-NL",
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "fr-FR",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ko-KR",
  "pt-BR",
  "ru-RU",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
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
  "hi-IN": hiIN,
  "id-ID": idID,
  "it-IT": itIT,
  "es-ES": esES,
  "ko-KR": koKR,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
  "tr-TR": trTR,
  "uk-UA": ukUA,
  "vi-VN": viVN,
  "zh-CN": zhCN,
} as const;
