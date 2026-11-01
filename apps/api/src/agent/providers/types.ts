import type { ProviderV3, ProviderV4 } from "@ai-sdk/provider";

export type AgentProvider = ProviderV3 | ProviderV4;

export type AgentModelPolicy = { model: string; models: string[] };

export type ProviderSettings = {
  apiKey?: string;
  baseURL?: string;
  resourceName?: string;
  region?: string;
  workspaceId?: string;
  project?: string;
  location?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
};

export type BuiltinProvider = {
  apiKeyEnv?: string;
  load: (settings: ProviderSettings) => Promise<AgentProvider>;
};
