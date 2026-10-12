export const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9-]+$/;
export const GITEA_OWNER_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export type RepositoryPath = {
  owner: string;
  name: string;
};

export function parseRepositoryPath(
  value: string,
  ownerPattern: RegExp,
): RepositoryPath | null {
  const parts = value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/");
  if (parts.length !== 2) return null;
  const [owner = "", name = ""] = parts;
  if (!ownerPattern.test(owner) || !NAME_PATTERN.test(name)) return null;
  return { owner, name };
}

export function formatRepositoryPath(owner: string, name: string) {
  return owner && name ? `${owner}/${name}` : "";
}
