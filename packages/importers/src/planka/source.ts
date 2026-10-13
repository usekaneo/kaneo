import { SourceHttpError } from "../http.js";
import type {
  ConnectOptions,
  ImportedProject,
  ImportSource,
  ReadProjectOptions,
  SourceProject,
} from "../types.js";
import { type CardComments, importableCards, mapBoard } from "./board.js";
import { type BoardBundle, PlankaClient } from "./client.js";
import {
  boardProjectName,
  listBoardEntries,
  type PlankaBoardEntry,
} from "./mapping.js";

export type PlankaCredentials = {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
};

export async function connectPlanka(
  credentials: PlankaCredentials,
  options: ConnectOptions,
): Promise<ImportSource> {
  const url = credentials.url?.trim();
  if (!url) throw new Error("Enter the URL of your PLANKA instance.");

  const apiKey = credentials.apiKey?.trim();
  const username = credentials.username?.trim();
  const password = credentials.password;
  if (!apiKey && !(username && password)) {
    throw new Error(
      "Enter a PLANKA API key, or the username and password of a PLANKA account.",
    );
  }

  const client = new PlankaClient({
    baseUrl: url,
    ...(apiKey ? { apiKey } : {}),
    fetch: options.fetch,
    signal: options.signal,
  });

  if (!apiKey && username && password) {
    await client.login(username, password);
  }

  let entries = await loadEntries(client);

  async function findEntry(boardId: string): Promise<PlankaBoardEntry> {
    const cached = entries.find((entry) => entry.board.id === boardId);
    if (cached) return cached;
    entries = await loadEntries(client);
    const fresh = entries.find((entry) => entry.board.id === boardId);
    if (!fresh) throw boardNotFound();
    return fresh;
  }

  return {
    async listProjects(): Promise<SourceProject[]> {
      entries = await loadEntries(client);
      return entries.map((entry) => ({
        id: entry.board.id,
        name: projectName(entry),
        detail: entry.project.name,
      }));
    },

    async readProject(
      boardId: string,
      readOptions: ReadProjectOptions,
    ): Promise<ImportedProject> {
      const entry = await findEntry(boardId);
      const scoped = client.withSignal(readOptions.signal);
      const name = projectName(entry);

      readOptions.onProgress?.(`Reading board ${name}`);
      const bundle = await readBoard(scoped, boardId);

      const commentsByCardId = readOptions.includeComments
        ? await readComments(scoped, bundle, readOptions.onProgress)
        : new Map<string, CardComments>();

      return mapBoard(bundle, name, commentsByCardId);
    },
  };
}

async function loadEntries(client: PlankaClient): Promise<PlankaBoardEntry[]> {
  return listBoardEntries(await client.listProjects());
}

function projectName(entry: PlankaBoardEntry): string {
  return boardProjectName(
    entry.project.name,
    entry.board.name,
    entry.boardCountInProject,
  );
}

async function readBoard(
  client: PlankaClient,
  boardId: string,
): Promise<BoardBundle> {
  try {
    return await client.getBoard(boardId);
  } catch (error) {
    if (error instanceof SourceHttpError && error.status === 404) {
      throw boardNotFound();
    }
    throw error;
  }
}

async function readComments(
  client: PlankaClient,
  bundle: BoardBundle,
  onProgress: ((message: string) => void) | undefined,
): Promise<Map<string, CardComments>> {
  const cards = importableCards(bundle).filter(
    (card) => card.commentsTotal !== 0,
  );
  const commentsByCardId = new Map<string, CardComments>();

  for (const [index, card] of cards.entries()) {
    onProgress?.(`Reading comments (${index + 1} of ${cards.length} cards)`);
    commentsByCardId.set(card.id, await client.listComments(card.id));
  }

  return commentsByCardId;
}

function boardNotFound(): Error {
  return new Error(
    "This PLANKA board was not found. It may have been deleted, or the connected account can no longer access it.",
  );
}
