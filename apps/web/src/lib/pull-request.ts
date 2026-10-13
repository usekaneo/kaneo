import { getExternalWebUrl } from "@/lib/external-url";
import type { ExternalLink } from "@/types/external-link";

export type PullRequest = ExternalLink & { href: string };

export type PullRequestStatus = "merged" | "draft" | "open";

export function getPullRequests(
  externalLinks: ExternalLink[] | null | undefined,
): PullRequest[] {
  return (externalLinks ?? []).flatMap((link) => {
    if (link.resourceType !== "pull_request") return [];
    const href = getExternalWebUrl(link.url);
    return href ? [{ ...link, href }] : [];
  });
}

export function getPullRequestStatus(pr: ExternalLink): PullRequestStatus {
  if (pr.metadata?.merged === true) return "merged";
  if (pr.metadata?.draft === true) return "draft";
  return "open";
}

export function getPullRequestsStatus(
  pullRequests: ExternalLink[],
): PullRequestStatus {
  const statuses = pullRequests.map(getPullRequestStatus);
  if (statuses.every((status) => status === "merged")) return "merged";
  if (statuses.includes("open")) return "open";
  return "draft";
}

export function getPullRequestRepoName(url: string) {
  return url.match(/github\.com\/([^/]+\/[^/]+)\/pull/)?.[1] ?? null;
}
