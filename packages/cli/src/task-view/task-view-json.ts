import {
  type CommentJson,
  latest,
  toCommentJson,
} from "../comments/comment-json.js";
import { type LinkJson, toLinkJson } from "../external-links/link-json.js";
import type { TaskFieldJson } from "../fields/render-task-fields.js";
import { type TaskLabelJson, toTaskLabelJson } from "../labels/label-json.js";
import {
  groupRelations,
  type RelatedTaskJson,
  type RelationJson,
} from "../relations/group-relations.js";
import type { ResolvedTask } from "../tasks/resolve-task.js";
import {
  type TaskDetailJson,
  toTaskDetailJson,
} from "../tasks/task-detail-json.js";
import { mapSection, sectionValue } from "./section-result.js";
import { toTaskFieldsJson } from "./task-fields-json.js";
import type {
  TaskViewSectionName,
  TaskViewSections,
} from "./task-view-sections.js";
import { summarizeTime, type TimeSummaryJson } from "./time-summary.js";

export type TaskViewErrors = Readonly<
  Partial<Record<TaskViewSectionName, string>>
>;

export type TaskViewJson = TaskDetailJson & {
  readonly labels: ReadonlyArray<TaskLabelJson> | null;
  readonly parent: RelatedTaskJson | null;
  readonly subtasks: ReadonlyArray<RelatedTaskJson> | null;
  readonly relations: ReadonlyArray<RelationJson> | null;
  readonly links: ReadonlyArray<LinkJson> | null;
  readonly fields: ReadonlyArray<TaskFieldJson> | null;
  readonly time: TimeSummaryJson | null;
  readonly comments: ReadonlyArray<CommentJson> | null;
  readonly errors?: TaskViewErrors;
};

export type TaskViewInput = {
  readonly resolved: ResolvedTask;
  readonly sections: TaskViewSections;
  readonly projectSlugs: ReadonlyMap<string, string>;
  readonly webUrl: string;
  readonly commentLimit: number;
  readonly now: Date;
};

function sectionErrors(sections: TaskViewSections): TaskViewErrors {
  const errors: Partial<Record<TaskViewSectionName, string>> = {};
  for (const [name, section] of Object.entries(sections)) {
    if (section._tag === "Failed") {
      errors[name as TaskViewSectionName] = section.message;
    }
  }
  return errors;
}

export function toTaskViewJson(input: TaskViewInput): TaskViewJson {
  const { resolved, sections } = input;
  const relations = sectionValue(
    mapSection(sections.relations, (value) =>
      groupRelations(value, resolved.task.id, {
        projectSlugs: input.projectSlugs,
        workspaceId: resolved.workspaceId,
        webUrl: input.webUrl,
      }),
    ),
  );
  const errors = sectionErrors(sections);
  return {
    ...toTaskDetailJson(resolved),
    labels: sectionValue(
      mapSection(sections.labels, (labels) => labels.map(toTaskLabelJson)),
    ),
    parent: relations?.parent ?? null,
    subtasks: relations?.subtasks ?? null,
    relations: relations?.relations ?? null,
    links: sectionValue(
      mapSection(sections.links, (links) => links.map(toLinkJson)),
    ),
    fields: sectionValue(mapSection(sections.fields, toTaskFieldsJson)),
    time: sectionValue(
      mapSection(sections.time, (entries) => summarizeTime(entries, input.now)),
    ),
    comments: sectionValue(
      mapSection(sections.comments, (comments) =>
        latest(comments, input.commentLimit).map(toCommentJson),
      ),
    ),
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
}
