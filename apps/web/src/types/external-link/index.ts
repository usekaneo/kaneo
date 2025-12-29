export type ExternalLinkMetadata = {
  state?: string;
  merged?: boolean;
  mergedAt?: string;
  draft?: boolean;
  branch?: string;
  author?: string;
  createdFrom?: "github" | "kaneo";
  lastCommit?: {
    sha: string;
    message: string;
    author?: string;
    timestamp: string;
  };
};

export type ExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: "issue" | "pull_request" | "branch";
  externalId: string;
  url: string;
  title: string | null;
  metadata: ExternalLinkMetadata | null;
  createdAt: string;
  updatedAt: string;
  integration?: {
    id: string;
    type: string;
    config: string;
  };
};
