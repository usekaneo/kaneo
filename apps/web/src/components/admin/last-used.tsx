import { useTranslation } from "react-i18next";
import { formatDateMedium, formatDateTime } from "@/lib/format";

function LastUsed({ value }: { value: string | null }) {
  const { t } = useTranslation();
  return value ? (
    <time dateTime={value} title={formatDateTime(value)}>
      {formatDateMedium(value)}
    </time>
  ) : (
    <span>{t("settings:adminLastUsed.unknown")}</span>
  );
}

export default LastUsed;
