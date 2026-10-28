import type useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";

export type WorkspaceLabel = NonNullable<
  ReturnType<typeof useGetLabelsByWorkspace>["data"]
>[number];
