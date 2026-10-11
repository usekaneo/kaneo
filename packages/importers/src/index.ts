import { connectKaneo, type KaneoCredentials } from "./kaneo/index.js";
import { connectLinear, type LinearCredentials } from "./linear/index.js";
import { connectPlane, type PlaneCredentials } from "./plane/index.js";
import { connectPlanka, type PlankaCredentials } from "./planka/index.js";
import { connectTrello, type TrelloCredentials } from "./trello/index.js";
import type { ConnectOptions, ImportSource } from "./types.js";

export { normalizeBaseUrl, SourceHttpError } from "./http.js";
export {
  SOURCE_PROJECT_KEY_MAX,
  sanitizeProjectKey,
  toProjectKey,
  uniqueKey,
} from "./keys.js";
export { trelloAuthorizeUrl } from "./trello/index.js";
export type * from "./types.js";
export type {
  KaneoCredentials,
  LinearCredentials,
  PlaneCredentials,
  PlankaCredentials,
  TrelloCredentials,
};

export const IMPORT_SOURCE_IDS = [
  "planka",
  "plane",
  "linear",
  "trello",
  "kaneo",
] as const;

export type ImportSourceId = (typeof IMPORT_SOURCE_IDS)[number];

export type ImportCredentials = {
  planka: PlankaCredentials;
  plane: PlaneCredentials;
  linear: LinearCredentials;
  trello: TrelloCredentials;
  kaneo: KaneoCredentials;
};

export type ImportConnection = {
  [Source in ImportSourceId]: { source: Source } & ImportCredentials[Source];
}[ImportSourceId];

export function connectSource(
  connection: ImportConnection,
  options: ConnectOptions = {},
): Promise<ImportSource> {
  switch (connection.source) {
    case "planka":
      return connectPlanka(connection, options);
    case "plane":
      return connectPlane(connection, options);
    case "linear":
      return connectLinear(connection, options);
    case "trello":
      return connectTrello(connection, options);
    case "kaneo":
      return connectKaneo(connection, options);
  }
}
