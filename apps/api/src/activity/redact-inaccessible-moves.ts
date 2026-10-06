import { findInaccessibleProjectIds } from "../project-access/find-inaccessible-project-ids";

type MoveData = Record<string, unknown>;

function moveData(row: { type: string; eventData: unknown }) {
  return row.type === "moved" &&
    row.eventData &&
    typeof row.eventData === "object" &&
    !Array.isArray(row.eventData)
    ? (row.eventData as MoveData)
    : null;
}

function redactSide(data: MoveData, side: "from" | "to", hidden: Set<string>) {
  const projectId = data[`${side}ProjectId`];
  return typeof projectId === "string" && hidden.has(projectId)
    ? { [`${side}ProjectId`]: null, [`${side}ProjectName`]: null }
    : {};
}

export async function redactInaccessibleMoves<
  T extends { type: string; eventData: unknown },
>(viewerId: string, rows: T[]): Promise<T[]> {
  const projectIds = rows.flatMap((row) => {
    const data = moveData(row);
    return data
      ? [data.fromProjectId, data.toProjectId].filter(
          (id): id is string => typeof id === "string",
        )
      : [];
  });
  const hidden = new Set(
    await findInaccessibleProjectIds(viewerId, projectIds),
  );
  if (hidden.size === 0) return rows;

  return rows.map((row) => {
    const data = moveData(row);
    if (!data) return row;
    return {
      ...row,
      eventData: {
        ...data,
        ...redactSide(data, "from", hidden),
        ...redactSide(data, "to", hidden),
      },
    };
  });
}
