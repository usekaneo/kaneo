import {
  ChevronDown,
  ChevronRight,
  FolderGit,
  GitMerge,
  GitPullRequest,
  Link,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitlabIcon } from "@/components/icons/gitlab-icon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ResourceLinkDialog from "./resource-link-dialog";
import useCreateExternalLink from "@/hooks/mutations/external-link/use-create-external-link";
import useDeleteExternalLink from "@/hooks/mutations/external-link/use-delete-external-link";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type { ExternalLink } from "@/types/external-link";

interface ExternalLinksAccordionProps {
  taskId: string;
  externalLinks: ExternalLink[];
  isLoading?: boolean;
}

function isGiteaResourceLink(link: ExternalLink) {
  if (link.integration?.type === "gitea") {
    return true;
  }

  const from = link.metadata?.createdFrom;
  return from === "gitea" || from === "gitea-import";
}

function isGitlabResourceLink(link: ExternalLink) {
  if (link.integration?.type === "gitlab") {
    return true;
  }
  const from = link.metadata?.createdFrom;
  return from === "gitlab" || from === "gitlab-import";
}

export function ExternalLinksAccordion({
  taskId,
  externalLinks,
  isLoading,
}: ExternalLinksAccordionProps) {
  const { t } = useTranslation();
  const { canUpdateTasks } = useWorkspacePermission();
  const canAddResource = canUpdateTasks();
  const [isOpen, setIsOpen] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const createExternalLink = useCreateExternalLink();
  const deleteExternalLink = useDeleteExternalLink();

  const linksWithoutRedundantBranches = useMemo(() => {
    const hasPR = externalLinks.some(
      (link) => link.resourceType === "pull_request",
    );

    if (hasPR) {
      return externalLinks.filter((link) => link.resourceType !== "branch");
    }

    return externalLinks;
  }, [externalLinks]);

  const getStatusBadge = (link: ExternalLink) => {
    const isMerged = link.metadata?.merged === true;
    const isDraft = link.metadata?.draft === true;
    const isPR = link.resourceType === "pull_request";
    const isIssue = link.resourceType === "issue";
    const isBranch = link.resourceType === "branch";

    if (isIssue && link.metadata?.syncFilterPaused === true) {
      return (
        <span className="text-xs font-medium text-warning-foreground">
          {t("settings:syncRules.paused")}
        </span>
      );
    }

    if (isIssue) {
      return (
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings:externalLinks.issue")}
        </span>
      );
    }

    if (isBranch) {
      return (
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings:externalLinks.branch")}
        </span>
      );
    }

    if (!isPR) return null;

    if (isMerged) {
      return (
        <span className="flex items-center gap-1 font-medium text-info-foreground text-xs">
          <GitMerge className="size-3" />
          {t("settings:externalLinks.merged")}
        </span>
      );
    }

    if (isDraft) {
      return (
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <GitPullRequest className="size-3" />
          {t("settings:externalLinks.draft")}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 font-medium text-success-foreground text-xs">
        <GitPullRequest className="size-3" />
        {t("settings:externalLinks.open")}
      </span>
    );
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-1 px-0 h-8 hover:bg-transparent"
            >
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {t("settings:externalLinks.resources")}
              </span>
            </Button>
          </CollapsibleTrigger>

          {canAddResource && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 h-8"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="size-4" />
              {t("settings:externalLinks.addResource")}
            </Button>
          )}
        </div>

        <CollapsibleContent>
          {isLoading ? null : linksWithoutRedundantBranches.length > 0 ? (
            <div className="flex flex-col gap-2 mt-2">
              {linksWithoutRedundantBranches.map((link) => (
                <div key={link.id} className="flex items-center gap-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 flex-1 items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    {isGiteaResourceLink(link) ? (
                      <FolderGit className="size-4 flex-shrink-0 text-muted-foreground" />
                    ) : isGitlabResourceLink(link) ? (
                      <GitlabIcon className="size-4 flex-shrink-0 text-muted-foreground" />
                    ) : link.resourceType === "url" ? (
                      <Link className="size-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <GithubIcon className="size-4 flex-shrink-0 text-muted-foreground" />
                    )}

                    <span className="text-sm truncate flex-1 text-foreground/90 group-hover:text-foreground">
                      {link.title || link.externalId}
                      {link.resourceType !== "branch" &&
                        link.resourceType !== "url" && (
                          <span className="text-muted-foreground ml-2">
                            #{link.externalId}
                          </span>
                        )}
                    </span>

                    {getStatusBadge(link)}
                  </a>
                  {canAddResource &&
                    link.integrationId === null &&
                    link.resourceType === "url" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("settings:externalLinks.remove", {
                          title: link.title || link.url,
                        })}
                        disabled={deleteExternalLink.isPending}
                        onClick={() =>
                          deleteExternalLink.mutate({ taskId, id: link.id })
                        }
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 px-3 text-sm text-muted-foreground">
              {t("settings:externalLinks.empty")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {isDialogOpen && canAddResource && (
        <ResourceLinkDialog
          open
          onOpenChange={setIsDialogOpen}
          isPending={createExternalLink.isPending}
          onSubmit={(resource) => {
            if (!canAddResource || createExternalLink.isPending) return;
            createExternalLink.mutate(
              { taskId, ...resource },
              { onSuccess: () => setIsDialogOpen(false) },
            );
          }}
        />
      )}
    </>
  );
}
