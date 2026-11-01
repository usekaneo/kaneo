import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AgentSharedIndicator() {
  const { t } = useTranslation();
  const label = t("agent:sharing.shared");

  return (
    <Users
      role="img"
      aria-label={label}
      className="size-3.5 shrink-0 text-muted-foreground"
    >
      <title>{label}</title>
    </Users>
  );
}
