import { Effect, Option } from "effect";
import { listProjects, listWorkspaces } from "../api/endpoints.js";
import type { Project } from "../api/schemas.js";
import {
  ProjectNotFound,
  ProjectRequired,
  WorkspaceRequired,
} from "../errors/errors.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import { Session } from "./session.js";

export const resolveWorkspaceId = Effect.fn("selection.workspace")(
  function* () {
    const session = yield* Session;
    if (Option.isSome(session.workspace)) return session.workspace.value.id;
    const output = yield* Output;
    const workspaces =
      yield* withSpinner("Loading workspaces")(listWorkspaces());
    const [only] = workspaces;
    if (workspaces.length === 1 && only) return only.id;
    if (workspaces.length > 1 && output.interactive) {
      return yield* pick(
        "Choose a workspace",
        workspaces.map((workspace) => ({
          title: workspace.name,
          value: workspace.id,
          description: workspace.slug,
        })),
      );
    }
    return yield* new WorkspaceRequired();
  },
);

export function matchProject(
  projects: ReadonlyArray<Project>,
  reference: string,
): Project | undefined {
  const normalized = reference.normalize("NFKC").toLowerCase();
  return (
    projects.find((project) => project.id === reference) ??
    projects.find(
      (project) => project.slug.normalize("NFKC").toLowerCase() === normalized,
    ) ??
    projects.find((project) => project.name.toLowerCase() === normalized)
  );
}

export const resolveProject = Effect.fn("selection.project")(function* (
  workspaceId: string,
  reference: Option.Option<string>,
) {
  const session = yield* Session;
  const output = yield* Output;
  const projects = (yield* withSpinner("Loading projects")(
    listProjects(workspaceId),
  )).filter((project) => project.archivedAt === null);
  const wanted = Option.orElse(
    Option.map(reference, (ref) => ({ ref, source: null as string | null })),
    () =>
      Option.map(session.project, (project) => ({
        ref: project.ref,
        source: project.source,
      })),
  );
  if (Option.isSome(wanted)) {
    const match = matchProject(projects, wanted.value.ref);
    if (match) return match;
    return yield* new ProjectNotFound({
      query: wanted.value.ref,
      source: wanted.value.source,
    });
  }
  const [only] = projects;
  if (projects.length === 1 && only) return only;
  if (projects.length > 1 && output.interactive) {
    return yield* pick(
      "Choose a project",
      projects.map((project) => ({
        title: project.name,
        value: project,
        description: project.slug.toUpperCase(),
      })),
    );
  }
  return yield* new ProjectRequired();
});
