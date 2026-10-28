import type {
  ConnectOptions,
  ImportedProject,
  ImportSource,
  ReadProjectOptions,
} from "../types.js";
import {
  createTrelloClient,
  type TrelloClient,
  type TrelloMember,
} from "./client.js";
import { mapCommentActions } from "./comments.js";
import { describeAuthFailure } from "./errors.js";
import { mapBoard } from "./mapping.js";
import { mapBoardSummaries } from "./projects.js";

export type TrelloCredentials = { apiKey: string; token: string };

const CREDENTIAL_FORMAT = /^[A-Za-z0-9_-]+$/;

export async function connectTrello(
  credentials: TrelloCredentials,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  const { apiKey, token } = normalizeCredentials(credentials);
  const client = createTrelloClient({
    apiKey,
    token,
    fetch: options.fetch,
    signal: options.signal,
  });
  const owner = await fetchOwner(client);

  return {
    async listProjects() {
      const boards = await client.listBoards();
      const organizations = await client.listOrganizations();
      return mapBoardSummaries(boards, organizations);
    },
    readProject: (boardId, readOptions) =>
      readBoard(
        client.withSignal(readOptions.signal),
        owner,
        boardId,
        readOptions,
      ),
  };
}

async function readBoard(
  client: TrelloClient,
  owner: TrelloMember,
  boardId: string,
  options: ReadProjectOptions,
): Promise<ImportedProject> {
  options.onProgress?.("Reading board");
  const board = await client.getBoard(boardId);

  if (!options.includeComments) return mapBoard(board, { owner });

  const actions = await client.listCommentActions(boardId, (fetched) =>
    options.onProgress?.(`Reading comments (${fetched} so far)`),
  );
  return mapBoard(board, {
    owner,
    comments: mapCommentActions(actions, owner),
  });
}

async function fetchOwner(client: TrelloClient): Promise<TrelloMember> {
  let me: TrelloMember | null;
  try {
    me = await client.getMe();
  } catch (error) {
    const message = describeAuthFailure(error);
    if (message) throw new Error(message, { cause: error });
    throw error;
  }

  if (!me || typeof me.id !== "string" || me.id.length === 0) {
    throw new Error("Trello did not return the account for this token.");
  }
  return me;
}

function normalizeCredentials(
  credentials: TrelloCredentials,
): TrelloCredentials {
  const apiKey = credentials.apiKey?.trim() ?? "";
  const token = credentials.token?.trim() ?? "";

  if (!apiKey) throw new Error("A Trello API key is required.");
  if (!CREDENTIAL_FORMAT.test(apiKey)) {
    throw new Error("That does not look like a Trello API key.");
  }
  if (!token) {
    throw new Error("Paste the token Trello shows after you authorize Kaneo.");
  }
  if (!CREDENTIAL_FORMAT.test(token)) {
    throw new Error(
      "That does not look like a Trello token. Copy the whole token Trello shows after you click Allow.",
    );
  }

  return { apiKey, token };
}
