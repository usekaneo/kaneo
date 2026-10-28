import {
  ChevronRight,
  FolderGit,
  GitMerge,
  GitPullRequest,
  Link,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitlabIcon } from "@/components/icons/gitlab-icon";
import { SectionAddButton } from "@/components/task/sections/section-add-button";
import { SectionHeader } from "@/components/task/sections/section-header";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCreateExternalLink from "@/hooks/mutations/external-link/use-create-external-link";
import useDeleteExternalLink from "@/hooks/mutations/external-link/use-delete-external-link";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import type { ExternalLink } from "@/types/external-link";
import { linkHost } from "./link-host";

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
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

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

  const resetForm = () => {
    setUrl("");
    setTitle("");
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);

    if (!open && !createExternalLink.isPending) {
      resetForm();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAddResource || createExternalLink.isPending) return;

    createExternalLink.mutate(
      {
        taskId,
        url,
        ...(title.trim() ? { title: title.trim() } : {}),
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        },
      },
    );
  };

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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <section className="flex flex-col gap-1">
          <SectionHeader
            title={
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  data-task-action="resources"
                  className="flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("settings:externalLinks.resources")}
                  {!isOpen && (
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                  )}
                </button>
              </CollapsibleTrigger>
            }
            meta={
              linksWithoutRedundantBranches.length > 0 && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {linksWithoutRedundantBranches.length}
                </span>
              )
            }
            action={
              canAddResource && (
                <SectionAddButton
                  data-task-action="addLink"
                  aria-label={t("settings:externalLinks.addResource")}
                  title={t("settings:externalLinks.addResource")}
                  onClick={() => setIsDialogOpen(true)}
                />
              )
            }
          />

          <CollapsibleContent>
            {isLoading ? null : linksWithoutRedundantBranches.length > 0 ? (
              <div className="flex flex-col">
                {linksWithoutRedundantBranches.map((link) => {
                  const isUrl = link.resourceType === "url";
                  const removable =
                    canAddResource && link.integrationId === null && isUrl;

                  return (
                    <div key={link.id} className={sectionRowClass}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch outline-none focus-visible:underline"
                      >
                        {isGiteaResourceLink(link) ? (
                          <FolderGit className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : isGitlabResourceLink(link) ? (
                          <GitlabIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : isUrl ? (
                          <Link className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <GithubIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 shrink truncate text-[13px] text-foreground/85 group-hover:text-foreground">
                          {link.title || link.externalId}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-muted-foreground/70 text-xs",
                            !isUrl && "font-mono",
                          )}
                        >
                          {isUrl
                            ? linkHost(link.url)
                            : link.resourceType !== "branch" &&
                              `#${link.externalId}`}
                        </span>
                        {getStatusBadge(link)}
                      </a>
                      {removable && (
                        <button
                          type="button"
                          aria-label={t("settings:externalLinks.remove", {
                            title: link.title || link.url,
                          })}
                          disabled={deleteExternalLink.isPending}
                          onClick={() =>
                            deleteExternalLink.mutate({ taskId, id: link.id })
                          }
                          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-2 py-1 text-muted-foreground text-xs">
                {t("settings:externalLinks.empty")}
              </p>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>

      <Dialog
        open={isDialogOpen && canAddResource}
        onOpenChange={handleDialogChange}
      >
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {t("settings:externalLinks.addResource")}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="external-resource-url">
                  {t("settings:externalLinks.url")}
                </Label>
                <Input
                  id="external-resource-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="external-resource-title">
                  {t("settings:externalLinks.titleOptional")}
                </Label>
                <Input
                  id="external-resource-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={createExternalLink.isPending}
              >
                {t("settings:externalLinks.cancel")}
              </Button>

              <Button
                type="submit"
                disabled={createExternalLink.isPending || !url.trim()}
              >
                {createExternalLink.isPending
                  ? t("settings:externalLinks.adding")
                  : t("settings:externalLinks.addResource")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
