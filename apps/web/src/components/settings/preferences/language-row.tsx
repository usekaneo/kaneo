import {
  type AppLocale,
  defaultLocale,
  supportedLocales,
} from "@i18n/resources";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/hooks/use-locale";
import { getLocaleLabel } from "@/lib/i18n/get-locale-label";

export function LanguageRow() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const selectedLocale: AppLocale = locale ?? defaultLocale;

  return (
    <SettingsRow stack title={t("settings:preferencesPage.language")}>
      <Select
        value={selectedLocale}
        onValueChange={(value) => {
          if (value) {
            void setLocale(value as AppLocale);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className="sm:w-48"
          aria-label={t("settings:preferencesPage.language")}
        >
          <SelectValue
            placeholder={t("settings:preferencesPage.selectLanguage")}
          >
            {getLocaleLabel(selectedLocale)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {supportedLocales.map((supportedLocale) => (
            <SelectItem key={supportedLocale} value={supportedLocale}>
              {getLocaleLabel(supportedLocale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
