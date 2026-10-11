import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImportSourceId } from "@/components/import/import-source-definitions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type ImportOptionsCardProps = {
  sourceId: ImportSourceId;
  workspaceId: string;
  workspaceName: string;
  includeComments: boolean;
  onIncludeCommentsChange: (includeComments: boolean) => void;
};

export function ImportOptionsCard({
  sourceId,
  workspaceId,
  workspaceName,
  includeComments,
  onIncludeCommentsChange,
}: ImportOptionsCardProps) {
  const { t } = useTranslation();

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0 space-y-0.5">
          <p id="import-comments-label" className="font-medium text-sm">
            {t("settings:workspaceImport.select.commentsLabel")}
          </p>
          <p
            id="import-comments-description"
            className="text-muted-foreground text-xs"
          >
            {t("settings:workspaceImport.select.commentsDescription")}
          </p>
        </div>
        <Switch
          checked={includeComments}
          onCheckedChange={onIncludeCommentsChange}
          aria-labelledby="import-comments-label"
          aria-describedby="import-comments-description"
        />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Users
            aria-hidden="true"
            className="mt-px size-4 shrink-0 text-muted-foreground"
          />
          <p className="text-muted-foreground text-xs">
            {sourceId === "trello"
              ? t("settings:workspaceImport.select.membersNoteTrello", {
                  workspace: workspaceName,
                })
              : t("settings:workspaceImport.select.membersNote", {
                  workspace: workspaceName,
                })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/members"
              params={{ workspaceId }}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          {t("settings:workspaceImport.select.inviteMembers")}
          <span className="sr-only">
            {t("settings:workspaceImport.opensInNewTab")}
          </span>
        </Button>
      </div>
    </div>
  );
}
