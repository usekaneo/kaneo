import { useTranslation } from "react-i18next";

export function useFieldTypes() {
  const { t } = useTranslation(["mobile"]);
  return [
    { value: "text", label: t("mobile:projectSettings.text") },
    { value: "number", label: t("mobile:projectSettings.number") },
    { value: "date", label: t("mobile:projectSettings.date") },
    { value: "boolean", label: t("mobile:projectSettings.checkbox") },
    { value: "dropdown", label: t("mobile:projectSettings.dropdown") },
    { value: "multiselect", label: t("mobile:projectSettings.multiSelect") },
  ] as const;
}
