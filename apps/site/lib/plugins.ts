import catalog from "../../../catalog/index.json";

export type CatalogPlugin = {
  package: string;
  repository: string;
  description: string;
  maintainers: string[];
  kaneo: string;
  addedAt: string;
  homepage?: string;
};

export const catalogPlugins: CatalogPlugin[] = catalog.plugins;

export const pluginLinks = {
  docs: "/docs/core/plugins",
  writing: "/docs/core/plugins/writing-plugins",
  getListed: "https://github.com/usekaneo/kaneo/blob/main/catalog/README.md",
  reportSecurity: "https://github.com/usekaneo/kaneo/security/advisories/new",
  reportIssue: "https://github.com/usekaneo/kaneo/issues/new",
};

export function installCommand(packageName: string) {
  return `kaneo plugin add ${packageName}`;
}
