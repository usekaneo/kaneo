import type { ImportedComment } from "../types.js";
import type {
  KaneoBoardTask,
  KaneoClient,
  KaneoMember,
  KaneoRelation,
} from "./client.js";
import { mapComments, needsAuthorNames } from "./mapping.js";
import { readOptional } from "./optional.js";
import {
  COMMENTS_UNAVAILABLE_WARNING,
  RELATIONS_UNAVAILABLE_WARNING,
} from "./warnings.js";

export type TaskDetails = {
  descriptions: Map<string, string>;
  comments: Map<string, ImportedComment[]>;
  relations: KaneoRelation[];
  warnings: string[];
};

export type ReadTaskDetailsOptions = {
  includeComments: boolean;
  members: Map<string, KaneoMember>;
  onProgress?: (message: string) => void;
};

const PROGRESS_EVERY = 50;

export async function readTaskDetails(
  client: KaneoClient,
  tasks: KaneoBoardTask[],
  options: ReadTaskDetailsOptions,
): Promise<TaskDetails> {
  const details: TaskDetails = {
    descriptions: new Map(),
    comments: new Map(),
    relations: [],
    warnings: [],
  };
  let relationsSupported = true;
  let commentsSupported = options.includeComments;
  let commentNamesSupported = true;
  const subject = options.includeComments
    ? "comments and task links"
    : "task links";

  for (const [index, task] of tasks.entries()) {
    if (task.descriptionDeferred) {
      const result = await readOptional(() =>
        client.getTaskDescription(task.id),
      );
      if (result.status === "ok" && result.value != null) {
        details.descriptions.set(task.id, result.value);
      }
    }

    if (relationsSupported) {
      const result = await readOptional(() => client.listRelations(task.id));
      if (result.status === "ok") details.relations.push(...result.value);
      if (result.status === "unsupported") {
        relationsSupported = false;
        details.warnings.push(RELATIONS_UNAVAILABLE_WARNING);
      }
    }

    if (commentsSupported) {
      const result = await readOptional(() => client.listActivities(task.id));
      if (result.status === "unsupported") {
        commentsSupported = false;
        details.warnings.push(COMMENTS_UNAVAILABLE_WARNING);
      }
      if (result.status === "ok") {
        const activities = result.value;
        let names = new Map<string, string>();
        if (
          commentNamesSupported &&
          needsAuthorNames(activities, options.members)
        ) {
          const fallback = await readOptional(() =>
            client.listComments(task.id),
          );
          if (fallback.status === "unsupported") commentNamesSupported = false;
          if (fallback.status === "ok") {
            names = new Map(
              fallback.value.flatMap((comment) => {
                const name = comment.user?.name?.trim();
                return name ? [[comment.id, name] as const] : [];
              }),
            );
          }
        }
        details.comments.set(
          task.id,
          mapComments(activities, options.members, names),
        );
      }
    }

    const done = index + 1;
    if (done % PROGRESS_EVERY === 0 || done === tasks.length) {
      options.onProgress?.(`Reading ${subject} (${done} of ${tasks.length})`);
    }
  }

  return details;
}
