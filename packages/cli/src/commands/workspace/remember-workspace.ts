import { normalizeBaseUrl } from "@kaneo/mcp/normalize-base-url";
import { type ConfigFile, withProfile } from "../../config/format.js";

export type RememberedWorkspace =
  | { readonly kind: "saved"; readonly config: ConfigFile }
  | { readonly kind: "other-server"; readonly profileApiUrl: string };

export function rememberWorkspace(
  config: ConfigFile,
  profileName: string,
  apiUrl: string,
  workspaceId: string,
): RememberedWorkspace {
  const stored = config.profiles[profileName];
  if (stored && normalizeBaseUrl(stored.apiUrl) !== normalizeBaseUrl(apiUrl)) {
    return { kind: "other-server", profileApiUrl: stored.apiUrl };
  }
  const updated = withProfile(config, profileName, (profile) => ({
    ...(profile ?? { apiUrl }),
    workspaceId,
  }));
  return {
    kind: "saved",
    config: { ...updated, activeProfile: config.activeProfile },
  };
}
