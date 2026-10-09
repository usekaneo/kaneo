import { Effect, Option } from "effect";
import {
  listProjectRecords,
  type ProjectRecordWithStatistics,
} from "../api/project-writes.js";
import { InvalidArgument, ProjectNotFound } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import { Session } from "../services/session.js";
import { matchProjectRecord } from "./match-project.js";

export type ProjectScope = "active" | "archived" | "any";

function inScope(project: ProjectRecordWithStatistics, scope: ProjectScope) {
  if (scope === "any") return true;
  return scope === "archived"
    ? project.archivedAt !== null
    : project.archivedAt === null;
}

export const resolveProjectRecord = Effect.fn("projects.resolveRecord")(
  function* (options: {
    readonly workspaceId: string;
    readonly reference: Option.Option<string>;
    readonly scope: ProjectScope;
    readonly useContext: boolean;
    readonly prompt: string;
    readonly missing: string;
    readonly example: string;
  }) {
    const session = yield* Session;
    const output = yield* Output;
    const projects = yield* withSpinner("Loading projects")(
      listProjectRecords(options.workspaceId),
    );
    const wanted = Option.orElse(
      Option.map(options.reference, (ref) => ({
        ref,
        source: null as string | null,
      })),
      () =>
        options.useContext
          ? Option.map(session.project, (project) => ({
              ref: project.ref,
              source: project.source as string | null,
            }))
          : Option.none(),
    );
    if (Option.isSome(wanted)) {
      const match = matchProjectRecord(projects, wanted.value.ref);
      if (match) return match;
      return yield* new ProjectNotFound({
        query: wanted.value.ref,
        source: wanted.value.source,
      });
    }
    const candidates = projects.filter((project) =>
      inScope(project, options.scope),
    );
    if (candidates.length > 0 && output.interactive) {
      return yield* pick(
        options.prompt,
        candidates.map((project) => ({
          title: project.name,
          value: project,
          description: project.slug.toUpperCase(),
        })),
      );
    }
    return yield* new InvalidArgument({
      message: options.missing,
      hint: `Pass its key or id, for example ${options.example}.`,
    });
  },
);
