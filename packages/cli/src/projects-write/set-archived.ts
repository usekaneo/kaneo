import { Effect, type Option } from "effect";
import { archiveProject, unarchiveProject } from "../api/project-writes.js";
import { emit } from "../output/emit.js";
import { withSpinner } from "../output/spinner.js";
import { resolveWorkspaceId } from "../services/selection.js";
import { Session } from "../services/session.js";
import { explainKeyConflict } from "./key-conflict.js";
import { toProjectRecordJson } from "./project-record-json.js";
import {
  renderProjectChange,
  renderProjectUnchanged,
} from "./render-project-change.js";
import { resolveProjectRecord } from "./resolve-project-record.js";

export const setArchived = Effect.fn("projects.setArchived")(function* (
  reference: Option.Option<string>,
  archived: boolean,
) {
  const session = yield* Session;
  const workspaceId = yield* resolveWorkspaceId();
  const verb = archived ? "archive" : "unarchive";
  const project = yield* resolveProjectRecord({
    workspaceId,
    reference,
    scope: archived ? "active" : "archived",
    useContext: true,
    prompt: `Choose a project to ${verb}`,
    missing: `Which project should be ${verb}d?`,
    example: `kaneo project ${verb} KAN`,
  });

  if ((project.archivedAt !== null) === archived) {
    const json = toProjectRecordJson(
      project,
      project.statistics,
      session.webUrl,
    );
    return yield* emit(json, (ui) =>
      renderProjectUnchanged(ui, {
        name: json.name,
        key: json.key,
        url: json.url,
        state: archived ? "archived" : "active",
      }),
    );
  }

  const updated = archived
    ? yield* withSpinner(`Archiving ${project.name}`)(
        archiveProject(project.id),
      )
    : yield* withSpinner(`Restoring ${project.name}`)(
        unarchiveProject(project.id),
      ).pipe(
        Effect.catchTag("Conflict", (conflict) =>
          explainKeyConflict(conflict, {
            workspaceId,
            name: project.name,
            key: project.slug,
            retry: `kaneo project edit ${project.id}`,
          }),
        ),
      );

  yield* emit(
    toProjectRecordJson(updated, project.statistics, session.webUrl),
    (ui, json) =>
      renderProjectChange(ui, {
        verb: archived ? "Archived" : "Restored",
        name: json.name,
        key: json.key,
        url: json.url,
      }),
  );
});
