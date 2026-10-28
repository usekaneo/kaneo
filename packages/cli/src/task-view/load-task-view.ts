import { Effect } from "effect";
import { listComments } from "../api/comments.js";
import { getProject, listColumns, listProjects } from "../api/endpoints.js";
import { listExternalLinks } from "../api/external-links.js";
import { listTaskLabels } from "../api/labels.js";
import type { Project } from "../api/schemas.js";
import { listTaskRelations } from "../api/task-relations.js";
import { listTimeEntries } from "../api/time-entries.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import { Session } from "../services/session.js";
import { fetchTask, type ResolvedTask } from "../tasks/resolve-task.js";
import {
  loaded,
  optionalSection,
  type SectionResult,
  sectionValue,
} from "./section-result.js";
import { listTaskFieldValuesWithNames } from "./task-field-values.js";
import type { TaskViewSections } from "./task-view-sections.js";

const SECTION_CONCURRENCY = 6;

export type LoadedTaskView = {
  readonly resolved: ResolvedTask;
  readonly sections: TaskViewSections;
  readonly projectSlugs: ReadonlyMap<string, string>;
};

export const loadTaskSections = (
  taskId: string,
  options: { readonly comments: boolean },
) =>
  Effect.all(
    {
      labels: optionalSection(listTaskLabels(taskId)),
      relations: optionalSection(listTaskRelations(taskId)),
      links: optionalSection(listExternalLinks(taskId)),
      fields: optionalSection(listTaskFieldValuesWithNames(taskId)),
      time: optionalSection(listTimeEntries(taskId)),
      comments: options.comments
        ? optionalSection(listComments(taskId))
        : Effect.succeed(loaded([])),
    },
    { concurrency: SECTION_CONCURRENCY },
  );

function foreignProjectIds(
  relations: TaskViewSections["relations"],
  known: ReadonlyMap<string, string>,
): boolean {
  return (sectionValue(relations) ?? []).some((relation) =>
    [relation.sourceTask, relation.targetTask].some(
      (task) => task !== null && !known.has(task.projectId),
    ),
  );
}

const relatedProjectSlugs = Effect.fnUntraced(function* (
  relations: TaskViewSections["relations"],
  project: Project,
  workspaceId: string,
) {
  const known = new Map([[project.id, project.slug]]);
  if (!foreignProjectIds(relations, known)) return known;
  const projects: SectionResult<ReadonlyArray<Project>> =
    yield* optionalSection(listProjects(workspaceId));
  for (const other of sectionValue(projects) ?? []) {
    known.set(other.id, other.slug);
  }
  return known;
});

export const loadTaskView = Effect.fn("taskView.load")(function* (
  reference: string,
  options: { readonly comments: boolean },
) {
  const session = yield* Session;
  const task = yield* fetchTask(reference);
  const [project, columns, sections] = yield* Effect.all(
    [
      getProject(task.projectId),
      listColumns(task.projectId),
      loadTaskSections(task.id, options),
    ],
    { concurrency: 3 },
  );
  const workspaceId = task.workspaceId ?? project.workspaceId;
  const resolved: ResolvedTask = {
    task,
    workspaceId,
    project,
    columns,
    ticketId: ticketId(project.slug, task.number),
    url: taskUrl(session.webUrl, {
      workspaceId,
      projectId: task.projectId,
      id: task.id,
    }),
  };
  const projectSlugs = yield* relatedProjectSlugs(
    sections.relations,
    project,
    workspaceId,
  );
  return { resolved, sections, projectSlugs } satisfies LoadedTaskView;
});
