import { useTranslation } from "react-i18next";

export function AutomationFieldError({
  id,
  error,
}: {
  id: string;
  error: string | undefined;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p id={id} className="text-destructive-foreground text-xs">
      {t(error)}
    </p>
  );
}
