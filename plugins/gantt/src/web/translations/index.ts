import type { Translations } from "@kaneo/plugin-sdk/web";
import { azAZ } from "./az-AZ.js";
import { deDE } from "./de-DE.js";
import { elGR } from "./el-GR.js";
import { enUS } from "./en-US.js";
import { esES } from "./es-ES.js";
import { frFR } from "./fr-FR.js";
import { hiIN } from "./hi-IN.js";
import { idID } from "./id-ID.js";
import { itIT } from "./it-IT.js";
import { jaJP } from "./ja-JP.js";
import { koKR } from "./ko-KR.js";
import { mkMK } from "./mk-MK.js";
import { nlNL } from "./nl-NL.js";
import { plPL } from "./pl-PL.js";
import { ptBR } from "./pt-BR.js";
import { ruRU } from "./ru-RU.js";
import { trTR } from "./tr-TR.js";
import { ukUA } from "./uk-UA.js";
import { viVN } from "./vi-VN.js";
import { zhCN } from "./zh-CN.js";

export const translations = {
  "az-AZ": azAZ,
  "de-DE": deDE,
  "el-GR": elGR,
  "en-US": enUS,
  "es-ES": esES,
  "fr-FR": frFR,
  "hi-IN": hiIN,
  "id-ID": idID,
  "it-IT": itIT,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "mk-MK": mkMK,
  "nl-NL": nlNL,
  "pl-PL": plPL,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
  "tr-TR": trTR,
  "uk-UA": ukUA,
  "vi-VN": viVN,
  "zh-CN": zhCN,
} satisfies Translations;
