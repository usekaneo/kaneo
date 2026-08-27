import { getApiUrl } from "@/fetchers/get-api-url";

export type ContractTemplate = {
  id: string;
  workspaceId: string;
  name: string;
  originalFilename: string;
  storageKey: string;
  mimeType?: string;
  sizeBytes?: number;
  bodyHtml?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractSubmission = {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  clientId: string;
  templateId: string;
  docusealSubmissionId: string;
  status: string;
  submitters: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

export async function getContractTemplates(workspaceId: string) {
  const response = await fetch(
    `${getApiUrl("/contract/templates")}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ContractTemplate[]>;
}

export async function createContractTemplate(input: {
  workspaceId: string;
  name: string;
  originalFilename?: string | null;
  bodyHtml?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}) {
  const response = await fetch(getApiUrl("/contract/templates"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ContractTemplate>;
}

export async function getContractSubmission(taskId: string) {
  const response = await fetch(getApiUrl(`/contract/submission/${taskId}`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ContractSubmission | null>;
}

export async function sendContract(input: {
  workspaceId: string;
  taskId: string;
  templateId: string;
  clientId: string;
}) {
  const response = await fetch(getApiUrl("/contract/send"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ContractSubmission>;
}
