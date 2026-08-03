export type ItemType = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  icon: string;
  description: string | null;
  position: number;
  archivedAt: string | null;
};
