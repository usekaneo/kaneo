import { Link } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { formatProviderList } from "@/components/project/automations/format-provider-list";
import { SettingsNote } from "@/components/settings/settings-note";

type ConnectMoreNoteProps = {
  projectId: string;
  providers: string[];
};

export function ConnectMoreNote({
  projectId,
  providers,
}: ConnectMoreNoteProps) {
  const { i18n } = useTranslation();

  return (
    <SettingsNote>
      <Trans
        i18nKey="settings:workflowEditor.connectMore"
        values={{ providers: formatProviderList(providers, i18n?.language) }}
        components={{
          link: (
            <Link
              to="/dashboard/settings/projects/$projectId/integrations"
              params={{ projectId }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            />
          ),
        }}
      />
    </SettingsNote>
  );
}
