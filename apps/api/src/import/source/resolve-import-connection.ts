import type { ImportConnection } from "@kaneo/importers";
import { HTTPException } from "hono/http-exception";
import type { ImportConnectionInput } from "../schema";
import { trelloApiKeyFromEnv } from "./trello-api-key";

export type ResolvedImportConnection = {
  connection: ImportConnection;
  secrets: string[];
  credentialHint: string;
};

export function resolveImportConnection(
  input: ImportConnectionInput,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedImportConnection {
  switch (input.source) {
    case "planka": {
      const { source, url, apiKey, username, password } = input;
      const usesPassword = !apiKey;
      return {
        connection: {
          source,
          url,
          ...(apiKey ? { apiKey } : { username, password }),
        },
        secrets: [apiKey, password].filter(isPresent),
        credentialHint: usesPassword
          ? "Check the username and password."
          : "Check the API key.",
      };
    }
    case "trello": {
      const apiKey = input.apiKey ?? trelloApiKeyFromEnv(env);
      if (!apiKey) {
        throw new HTTPException(400, { message: "Add a Trello API key." });
      }
      return {
        connection: { source: "trello", apiKey, token: input.token },
        secrets: [input.token, apiKey],
        credentialHint: "Check the API key and token.",
      };
    }
    case "plane":
      return {
        connection: input,
        secrets: [input.apiKey],
        credentialHint: "Check the API key.",
      };
    case "linear":
      return {
        connection: input,
        secrets: [input.apiKey],
        credentialHint: "Check the API key.",
      };
    case "kaneo":
      return {
        connection: input,
        secrets: [input.apiKey],
        credentialHint: "Check the API key.",
      };
  }
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
