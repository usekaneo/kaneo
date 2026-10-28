import { tokenFingerprint } from "@/lib/token-fingerprint";

export type GiteaAccess = {
  baseUrl: string;
  accessToken?: string;
  repositoryOwner: string;
  repositoryName: string;
};

export function giteaAccessKey(access: GiteaAccess) {
  return [
    access.baseUrl,
    access.repositoryOwner,
    access.repositoryName,
    access.accessToken ? tokenFingerprint(access.accessToken) : "stored",
  ].join("|");
}
