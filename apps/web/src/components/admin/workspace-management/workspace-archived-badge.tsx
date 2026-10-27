import { ArchiveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function WorkspaceArchivedBadge() {
  const { t } = useTranslation();

  return (
    <Badge variant="warning" className="shrink-0 gap-1 px-1.5">
      <ArchiveIcon aria-hidden="true" />
      {t("settings:adminWorkspaces.archived")}
    </Badge>
  );
}
