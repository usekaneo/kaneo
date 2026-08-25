import {
  ChevronDown,
  ChevronRight,
  FolderGit,
  GitMerge,
  GitPullRequest,
  Link,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
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

export function ExternalLinksAccordion({
  taskId,
  externalLinks,
  isLoading,
}: ExternalLinksAccordionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const createExternalLink = useCreateExternalLink();

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
        </div>

        <CollapsibleContent>
          {isLoading ? null : linksWithoutRedundantBranches.length > 0 ? (
            <div className="flex flex-col gap-2 mt-2">
              {linksWithoutRedundantBranches.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
                >
                  {isGiteaResourceLink(link) ? (
                    <FolderGit className="size-4 flex-shrink-0 text-muted-foreground" />
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
              ))}
            </div>
          ) : (
            <p className="mt-2 px-3 text-sm text-muted-foreground">
              {t("settings:externalLinks.empty")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {t("settings:externalLinks.addResource")}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="external-resource-url">
                  {t("settings:externalLinks.url")}
                </Label>
                <Input
                  id="external-resource-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://github.com/..."
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
                  placeholder="Fix authentication bug"
                  maxLength={200}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
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
