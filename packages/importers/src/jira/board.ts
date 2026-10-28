import { SourceHttpError } from "../http.js";
import type { JiraBoard, JiraBoardColumn } from "./api-types.js";
import type { JiraClient } from "./client.js";

export type BoardRead = {
  columns: JiraBoardColumn[] | null;
  unavailable: boolean;
};

const NO_BOARD_ACCESS = new Set([401, 403, 404]);

export async function readBoardColumns(
  client: JiraClient,
  projectKey: string,
): Promise<BoardRead> {
  let boards: JiraBoard[];
  try {
    boards = (await client.boards(projectKey))?.values ?? [];
  } catch (error) {
    const status = deniedStatus(error);
    if (status === undefined) throw error;
    return { columns: null, unavailable: status !== 404 };
  }

  const board = pickBoard(boards, projectKey);
  if (!board) return { columns: null, unavailable: false };

  try {
    const config = await client.boardConfiguration(board.id);
    const columns = config?.columnConfig?.columns;
    return columns?.length
      ? { columns, unavailable: false }
      : { columns: null, unavailable: true };
  } catch (error) {
    if (deniedStatus(error) === undefined) throw error;
    return { columns: null, unavailable: true };
  }
}

export function pickBoard(
  boards: JiraBoard[],
  projectKey: string,
): JiraBoard | undefined {
  const key = projectKey.toUpperCase();
  return (
    boards.find((board) => board.location?.projectKey?.toUpperCase() === key) ??
    boards[0]
  );
}

function deniedStatus(error: unknown): number | undefined {
  return error instanceof SourceHttpError && NO_BOARD_ACCESS.has(error.status)
    ? error.status
    : undefined;
}
