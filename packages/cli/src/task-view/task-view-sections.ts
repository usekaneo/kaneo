import type { TaskComment } from "../api/comments.js";
import type { ExternalLink } from "../api/external-links.js";
import type { Label } from "../api/labels.js";
import type { TaskRelationWithTasks } from "../api/task-relations.js";
import type { TimeEntryWithUser } from "../api/time-entries.js";
import type { SectionResult } from "./section-result.js";
import type { TaskFieldValue } from "./task-field-values.js";

export type TaskViewSections = {
  readonly labels: SectionResult<ReadonlyArray<Label>>;
  readonly relations: SectionResult<ReadonlyArray<TaskRelationWithTasks>>;
  readonly links: SectionResult<ReadonlyArray<ExternalLink>>;
  readonly fields: SectionResult<ReadonlyArray<TaskFieldValue>>;
  readonly time: SectionResult<ReadonlyArray<TimeEntryWithUser>>;
  readonly comments: SectionResult<ReadonlyArray<TaskComment>>;
};

export type TaskViewSectionName = keyof TaskViewSections;
