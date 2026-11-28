export type OfficialPlugin = {
  id: string;
  packageName: string;
};

export const OFFICIAL_PLUGINS: readonly OfficialPlugin[] = [
  { id: "gantt", packageName: "@kaneo/gantt" },
];
