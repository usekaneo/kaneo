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
  "ja-JP",
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

export function isSupportedLocale(locale: string): locale is AppLocale {
  return (supportedLocales as readonly string[]).includes(locale);
}

export async function loadLocale(locale: AppLocale): Promise<object> {
  switch (locale) {
    case "de-DE":
      return (await import("./de-DE.json")).default;
    case "el-GR":
      return (await import("./el-GR.json")).default;
    case "en-US":
      return (await import("./en-US.json")).default;
    case "es-ES":
      return (await import("./es-ES.json")).default;
    case "fr-FR":
      return (await import("./fr-FR.json")).default;
    case "hi-IN":
      return (await import("./hi-IN.json")).default;
    case "id-ID":
      return (await import("./id-ID.json")).default;
    case "it-IT":
      return (await import("./it-IT.json")).default;
    case "ja-JP":
      return (await import("./ja-JP.json")).default;
    case "ko-KR":
      return (await import("./ko-KR.json")).default;
    case "mk-MK":
      return (await import("./mk-MK.json")).default;
    case "nl-NL":
      return (await import("./nl-NL.json")).default;
    case "pt-BR":
      return (await import("./pt-BR.json")).default;
    case "ru-RU":
      return (await import("./ru-RU.json")).default;
    case "tr-TR":
      return (await import("./tr-TR.json")).default;
    case "uk-UA":
      return (await import("./uk-UA.json")).default;
    case "vi-VN":
      return (await import("./vi-VN.json")).default;
    case "zh-CN":
      return (await import("./zh-CN.json")).default;
  }
}
