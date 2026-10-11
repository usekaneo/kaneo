import { Import } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/settings-page";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function ImportNotAllowed() {
  const { t } = useTranslation();

  return (
    <SettingsPage title={t("settings:workspaceImport.title")}>
      <Empty className="rounded-xl border border-border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Import />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            {t("settings:workspaceImport.notAllowed.title")}
          </EmptyTitle>
          <EmptyDescription>
            {t("settings:workspaceImport.notAllowed.description")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </SettingsPage>
  );
}
