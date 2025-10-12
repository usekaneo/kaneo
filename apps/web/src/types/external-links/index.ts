export type ExternalLinkType =
  | "gitea_integration"
  | "github_integration"
  | "documentation"
  | "reference"
  | "design"
  | "ticket"
  | "custom";

export interface ExternalLink {
  id: string;
  taskId: string;
  type: ExternalLinkType;
  title: string;
  url: string;
  externalId?: string | null;
  createdAt: string; // API returns string, not Date
  createdBy?: string | null;
}

export interface CreateExternalLinkRequest {
  taskId: string;
  type: ExternalLinkType;
  title: string;
  url: string;
  externalId?: string;
}

export interface UpdateExternalLinkRequest {
  title: string;
  url: string;
  externalId?: string;
}
