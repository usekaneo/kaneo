import type {
  ConnectOptions,
  ImportedProject,
  ImportSource,
  ReadProjectOptions,
  SourceProject,
} from "../types.js";
import {
  type LinearComment,
  LinearClient,
  type LinearTeam,
  type LinearTeamSummary,
} from "./client.js";
import { LinearApiError } from "./graphql.js";
import { mapTeam } from "./mapping.js";

export type LinearCredentials = {
  apiKey: string;
};

export async function connectLinear(
  credentials: LinearCredentials,
  options: ConnectOptions,
): Promise<ImportSource> {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new Error(
      "Enter a Linear personal API key. Create one under Settings > Account > Security & access.",
    );
  }

  const client = new LinearClient({
    apiKey,
    fetch: options.fetch,
    signal: options.signal,
  });
  await client.viewer();

  return {
    async listProjects(): Promise<SourceProject[]> {
      const teams = await client.listTeams();
      return teams.map((team) => ({
        id: team.id,
        name: team.name,
        detail: teamDetail(team),
      }));
    },

    async readProject(
      teamId: string,
      readOptions: ReadProjectOptions,
    ): Promise<ImportedProject> {
      const scoped = client.withSignal(readOptions.signal);
      const onProgress = readOptions.onProgress;

      onProgress?.("Reading team");
      const team = await readTeam(scoped, teamId);

      onProgress?.("Reading issues");
      const issues = await scoped.listIssues(teamId, (count) =>
        onProgress?.(`Reading issues (${count} so far)`),
      );

      let comments: LinearComment[] = [];
      if (readOptions.includeComments && issues.length > 0) {
        onProgress?.("Reading comments");
        comments = await scoped.listComments(teamId, (count) =>
          onProgress?.(`Reading comments (${count} so far)`),
        );
      }

      return mapTeam(team, issues, comments);
    },
  };
}

function teamDetail(team: LinearTeamSummary): string {
  if (typeof team.issueCount !== "number") return team.key;
  const issues =
    team.issueCount === 1 ? "1 issue" : `${team.issueCount} issues`;
  return `${team.key} · ${issues}`;
}

async function readTeam(
  client: LinearClient,
  teamId: string,
): Promise<LinearTeam> {
  try {
    return await client.getTeam(teamId);
  } catch (error) {
    if (error instanceof LinearApiError && /not found/i.test(error.message)) {
      throw new Error(
        "This Linear team was not found. It may have been deleted, or the API key can no longer access it.",
      );
    }
    throw error;
  }
}
