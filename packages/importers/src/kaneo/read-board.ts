import { boardTasks, type MergedBoard, mergeBoardPages } from "./board.js";
import type { KaneoBoard, KaneoClient } from "./client.js";

export type ReadBoardResult = MergedBoard & {
  project: KaneoBoard;
};

export async function readBoard(
  client: KaneoClient,
  projectId: string,
  onProgress?: (message: string) => void,
): Promise<ReadBoardResult> {
  const pages: KaneoBoard[] = [];
  let totalPages = 1;
  let read = 0;

  for (let page = 1; page <= totalPages; page++) {
    const first = await client.getBoardPage(projectId, page, 1);
    pages.push(first.board);
    totalPages = Math.max(1, first.pagination.totalPages ?? 1);

    const relatedPages = Math.max(1, first.pagination.relatedTotalPages ?? 1);
    for (let related = 2; related <= relatedPages; related++) {
      const extra = await client.getBoardPage(projectId, page, related);
      pages.push(extra.board);
    }

    read += boardTasks(first.board).length;
    const total = Math.max(read, first.pagination.total ?? read);
    onProgress?.(`Reading tasks (${read} of ${total})`);
  }

  const [project] = pages;
  if (!project) throw new Error("Kaneo returned no board for this project.");
  return { project, ...mergeBoardPages(pages) };
}
