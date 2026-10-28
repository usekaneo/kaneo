import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function WorkspaceArchivedBadge() {
  const { t } = useTranslation();

  return (
    <Badge variant="warning" className="shrink-0 px-1.5">
      {t("settings:adminWorkspaces.archived")}
    </Badge>
  );
}
