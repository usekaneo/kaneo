export type OfficialPlugin = {
  id: string;
  packageName: string;
  importFactory: () => Promise<{ default?: unknown }>;
};

export const OFFICIAL_PLUGINS: readonly OfficialPlugin[] = [
  {
    id: "gantt",
    packageName: "@kaneo/gantt",
    importFactory: () => import("@kaneo/gantt"),
  },
];
