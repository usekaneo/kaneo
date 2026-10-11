import type { KaneoVersionSource } from "./kaneo-target.js";
import type { CatalogLookup } from "./lookup-catalog.js";
import type { ConfigUpdate } from "./update-config-file.js";

export type PluginAddResult = {
  readonly packageName: string;
  readonly version: string;
  readonly range: string;
  readonly kaneoVersion: string;
  readonly kaneoVersionSource: KaneoVersionSource;
  readonly catalog: CatalogLookup["status"];
  readonly projectDir: string;
  readonly installed: ReadonlyArray<string>;
  readonly createdPackageJson: boolean;
  readonly config: ConfigUpdate;
};
