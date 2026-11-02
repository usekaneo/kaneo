import { useTranslation } from "react-i18next";

// A type or location label; an em dash (read as "not set") when there is none.
export function ContactOptionValue({ label }: { label: string | null }) {
  const { t } = useTranslation();
  if (label) return <>{label}</>;
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("workspace:contacts.notSet")}</span>
    </span>
  );
}
