import {
  ChevronDown,
  ChevronRight,
  Github,
  GitMerge,
  GitPullRequest,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ExternalLink } from "@/types/external-link";

interface ExternalLinksAccordionProps {
  externalLinks: ExternalLink[];
  isLoading?: boolean;
}

export function ExternalLinksAccordion({
  externalLinks,
  isLoading,
}: ExternalLinksAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const linksWithoutRedundantBranches = useMemo(() => {
    const hasPR = externalLinks.some(
      (link) => link.resourceType === "pull_request",
    );
    if (hasPR) {
      return externalLinks.filter((link) => link.resourceType !== "branch");
    }
    return externalLinks;
  }, [externalLinks]);

  if (isLoading || linksWithoutRedundantBranches.length === 0) {
    return null;
  }

  const getStatusBadge = (link: ExternalLink) => {
    const isMerged = link.metadata?.merged === true;
    const isDraft = link.metadata?.draft === true;
    const isPR = link.resourceType === "pull_request";
    const isIssue = link.resourceType === "issue";
    const isBranch = link.resourceType === "branch";

    if (isIssue) {
      return (
        <span className="text-xs font-medium text-muted-foreground">Issue</span>
      );
    }

    if (isBranch) {
      return (
        <span className="text-xs font-medium text-muted-foreground">
          Branch
        </span>
      );
    }

    if (!isPR) return null;

    if (isMerged) {
      return (
        <span className="flex items-center gap-1 font-medium text-info-foreground text-xs">
          <GitMerge className="size-3" />
          Merged
        </span>
      );
    }

    if (isDraft) {
      return (
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <GitPullRequest className="size-3" />
          Draft
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 font-medium text-success-foreground text-xs">
        <GitPullRequest className="size-3" />
        Open
      </span>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1 px-0 h-8 hover:bg-transparent"
        >
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">Resources</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 mt-2">
          {linksWithoutRedundantBranches.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
            >
              <Github className="size-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm truncate flex-1 text-foreground/90 group-hover:text-foreground">
                {link.title || link.externalId}
                {link.resourceType !== "branch" && (
                  <span className="text-muted-foreground ml-2">
                    #{link.externalId}
                  </span>
                )}
              </span>
              {getStatusBadge(link)}
            </a>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
