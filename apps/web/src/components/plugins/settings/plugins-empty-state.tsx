import { ExternalLink, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const PLUGINS_DOCS_URL = "https://kaneo.app/docs/core/plugins";

export function PluginsEmptyState() {
  const { t } = useTranslation();

  return (
    <Empty className="rounded-md border border-border bg-sidebar">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Puzzle />
        </EmptyMedia>
        <EmptyTitle>{t("settings:workspacePlugins.empty.title")}</EmptyTitle>
        <EmptyDescription>
          {t("settings:workspacePlugins.empty.description")}
        </EmptyDescription>
      </EmptyHeader>
      <a
        href={PLUGINS_DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        {t("settings:workspacePlugins.empty.link")}
        <ExternalLink className="size-3.5" />
      </a>
    </Empty>
  );
}
