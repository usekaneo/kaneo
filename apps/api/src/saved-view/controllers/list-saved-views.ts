import { and, eq, isNull, or } from "drizzle-orm";
import db from "../../database";
import { savedViewTable } from "../../database/schema";
import resolveViewConfig, {
  type ViewConfigScope,
} from "../resolve-view-config";
import validateProjectScope from "../validate-project-scope";

type SavedView = typeof savedViewTable.$inferSelect;

function layerRank(view: SavedView) {
  if (view.userId && view.projectId) return 3;
  if (view.userId) return 2;
  if (view.projectId) return 1;
  return 0;
}

function viewScope(view: SavedView): ViewConfigScope {
  if (view.userId) return "user";
  if (view.projectId) return "project";
  return "workspace";
}

async function listSavedViews(
  workspaceId: string,
  projectId: string,
  userId: string,
) {
  await validateProjectScope(workspaceId, projectId);

  const rows = await db
    .select()
    .from(savedViewTable)
    .where(
      and(
        eq(savedViewTable.workspaceId, workspaceId),
        or(
          isNull(savedViewTable.projectId),
          eq(savedViewTable.projectId, projectId),
        ),
        or(isNull(savedViewTable.userId), eq(savedViewTable.userId, userId)),
      ),
    );

  const rowsByKey = new Map<string, SavedView[]>();
  for (const row of rows) {
    const layers = rowsByKey.get(row.key) ?? [];
    layers.push(row);
    rowsByKey.set(row.key, layers);
  }

  return [...rowsByKey.entries()]
    .map(([key, layers]) => {
      const orderedLayers = [...layers].sort(
        (left, right) => layerRank(left) - layerRank(right),
      );
      const mostSpecific = orderedLayers.at(-1);

      if (!mostSpecific) return null;

      return {
        key,
        name: mostSpecific.name,
        type: mostSpecific.type,
        position: mostSpecific.position,
        enabled: mostSpecific.enabled,
        configuration: resolveViewConfig(
          orderedLayers.map((layer) => ({
            scope: viewScope(layer),
            configuration: layer.configuration,
          })),
        ),
      };
    })
    .filter((view): view is NonNullable<typeof view> => Boolean(view?.enabled))
    .sort(
      (left, right) =>
        left.position - right.position || left.name.localeCompare(right.name),
    );
}

export default listSavedViews;
