import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { ImportSourceLogoTile } from "@/components/import/import-source-logo-tile";
import { Button } from "@/components/ui/button";

type ImportSourceRowProps = {
  source: ImportSourceDefinition;
};

export function ImportSourceRow({ source }: ImportSourceRowProps) {
  const { t } = useTranslation();
  const name = source.pickerNameKey ? t(source.pickerNameKey) : source.name;

  return (
    <li className="flex items-center gap-3.5 px-4 py-3.5">
      <ImportSourceLogoTile source={source} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium text-sm">{name}</p>
        <p className="line-clamp-2 text-muted-foreground text-xs">
          {t(source.descriptionKey)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-24 shrink-0"
        aria-label={t("settings:workspaceImport.sources.connectTo", {
          source: name,
        })}
        render={
          <Link
            to="/dashboard/settings/workspace/import"
            search={{ source: source.id }}
          />
        }
      >
        {t("settings:workspaceImport.sources.connect")}
      </Button>
    </li>
  );
}
