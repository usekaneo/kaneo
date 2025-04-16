import enTranslation from "@/i18n/locales/en/translation.json";
import jaTranslation from "@/i18n/locales/ja/translation.json";
import koTranslation from "@/i18n/locales/ko/translation.json";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    ko: { translation: koTranslation },
    ja: { translation: jaTranslation },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
