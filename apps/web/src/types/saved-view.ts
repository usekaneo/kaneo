export type ResolvedSavedView = {
  key: string;
  name: string;
  type: "board" | "list" | "gantt";
  position: number;
  enabled: boolean;
  configuration: Record<string, unknown>;
};
