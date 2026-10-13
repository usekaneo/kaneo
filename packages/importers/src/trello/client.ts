import { createJsonClient, SourceHttpError } from "../http.js";
import type { FetchLike } from "../types.js";
import { TOKEN_REJECTED } from "./errors.js";

export type TrelloMember = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

export type TrelloBoardSummary = {
  id: string;
  name: string;
  url?: string;
  idOrganization?: string | null;
};

export type TrelloOrganization = {
  id: string;
  displayName?: string | null;
};

export type TrelloList = {
  id: string;
  name: string;
  pos: number;
  closed?: boolean;
};

export type TrelloCard = {
  id: string;
  idShort?: number | null;
  name: string;
  desc?: string | null;
  due?: string | null;
  dueComplete?: boolean;
  start?: string | null;
  idList: string;
  idLabels?: string[];
  idMembers?: string[];
  idChecklists?: string[];
  pos: number;
  closed?: boolean;
  dateLastActivity?: string | null;
  badges?: { attachments?: number } | null;
};

export type TrelloLabel = {
  id: string;
  name?: string | null;
  color?: string | null;
};

export type TrelloCheckItem = {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  pos: number;
};

export type TrelloChecklist = {
  id: string;
  name: string;
  idCard: string;
  pos: number;
  checkItems?: TrelloCheckItem[];
};

export type TrelloBoard = {
  id: string;
  name: string;
  desc?: string | null;
  lists?: TrelloList[];
  cards?: TrelloCard[];
  labels?: TrelloLabel[];
  checklists?: TrelloChecklist[];
  members?: TrelloMember[];
};

export type TrelloCommentAction = {
  id: string;
  date?: string | null;
  idMemberCreator?: string | null;
  data?: { text?: string | null; card?: { id?: string | null } | null } | null;
  memberCreator?: TrelloMember | null;
};

export type TrelloClientOptions = {
  apiKey: string;
  token: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export type TrelloClient = {
  getMe(): Promise<TrelloMember>;
  listBoards(): Promise<TrelloBoardSummary[]>;
  listOrganizations(): Promise<TrelloOrganization[]>;
  getBoard(boardId: string): Promise<TrelloBoard>;
  listCommentActions(
    boardId: string,
    onPage?: (fetched: number) => void,
  ): Promise<TrelloCommentAction[]>;
  withSignal(signal: AbortSignal | undefined): TrelloClient;
};

export const TRELLO_API_URL = "https://api.trello.com/1";
export const COMMENT_PAGE_SIZE = 1000;

const CARD_FIELDS =
  "idShort,name,desc,due,dueComplete,start,idList,idLabels,idMembers,idChecklists,pos,closed,dateLastActivity,badges";

const BOARD_CONTENT_QUERY = [
  "fields=name,desc",
  "lists=all",
  "list_fields=name,pos,closed",
  "cards=all",
  `card_fields=${CARD_FIELDS}`,
  "labels=all",
  "label_fields=name,color",
  "labels_limit=1000",
  "checklists=all",
  "checklist_fields=name,idCard,pos",
  "checkItem_fields=name,state,pos",
  "members=all",
  "member_fields=fullName,username",
].join("&");

const COMMENTS_QUERY = [
  "filter=commentCard",
  `limit=${COMMENT_PAGE_SIZE}`,
  "fields=data,date,idMemberCreator",
  "memberCreator_fields=fullName,username",
].join("&");

const NOT_SPLITTABLE_STATUSES = new Set([401, 403, 404, 429]);

export function trelloAuthHeader(apiKey: string, token: string): string {
  return `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`;
}

export function createTrelloClient(options: TrelloClientOptions): TrelloClient {
  const http = createJsonClient({
    service: "Trello",
    baseUrl: TRELLO_API_URL,
    headers: () => ({
      Authorization: trelloAuthHeader(options.apiKey, options.token),
    }),
    fetch: options.fetch,
    signal: options.signal,
    describeUnauthorized: TOKEN_REJECTED,
  });

  async function list<T>(path: string): Promise<T[]> {
    const body = await http.request<T[] | null>(path);
    return Array.isArray(body) ? body : [];
  }

  async function getBoardInParts(boardId: string): Promise<TrelloBoard> {
    const base = `/boards/${boardId}`;
    const board = await http.request<TrelloBoard>(`${base}?fields=name,desc`);
    const lists = await list<TrelloList>(
      `${base}/lists?filter=all&fields=name,pos,closed`,
    );
    const cards = await list<TrelloCard>(
      `${base}/cards/all?fields=${CARD_FIELDS}`,
    );
    const labels = await list<TrelloLabel>(
      `${base}/labels?limit=1000&fields=name,color`,
    );
    const checklists = await list<TrelloChecklist>(
      `${base}/checklists?fields=name,idCard,pos&checkItem_fields=name,state,pos`,
    );
    const members = await list<TrelloMember>(
      `${base}/members?fields=fullName,username`,
    );
    return { ...board, lists, cards, labels, checklists, members };
  }

  const client: TrelloClient = {
    getMe: () =>
      http.request<TrelloMember>(
        "/members/me?fields=id,fullName,username,email",
      ),

    listBoards: () =>
      list<TrelloBoardSummary>(
        "/members/me/boards?filter=open&fields=name,url,idOrganization",
      ),

    listOrganizations: () =>
      list<TrelloOrganization>("/members/me/organizations?fields=displayName"),

    async getBoard(boardId) {
      const id = encodeURIComponent(boardId);
      try {
        return await http.request<TrelloBoard>(
          `/boards/${id}?${BOARD_CONTENT_QUERY}`,
        );
      } catch (error) {
        if (!isSplittable(error)) throw error;
        return getBoardInParts(id);
      }
    },

    async listCommentActions(boardId, onPage) {
      const path = `/boards/${encodeURIComponent(boardId)}/actions?${COMMENTS_QUERY}`;
      const actions: TrelloCommentAction[] = [];
      let before: string | undefined;

      while (true) {
        const page = await list<TrelloCommentAction>(
          before ? `${path}&before=${encodeURIComponent(before)}` : path,
        );
        actions.push(...page);
        onPage?.(actions.length);

        if (page.length < COMMENT_PAGE_SIZE) break;
        const oldest = page[page.length - 1];
        if (!oldest?.id || oldest.id === before) break;
        before = oldest.id;
      }

      return actions;
    },

    withSignal(signal) {
      if (!signal) return client;
      return createTrelloClient({
        ...options,
        signal: options.signal
          ? AbortSignal.any([options.signal, signal])
          : signal,
      });
    },
  };

  return client;
}

function isSplittable(error: unknown): boolean {
  return (
    error instanceof SourceHttpError &&
    error.status >= 400 &&
    error.status < 500 &&
    !NOT_SPLITTABLE_STATUSES.has(error.status)
  );
}
