import { useQuery } from "@tanstack/react-query";

import { loadDescription } from "@/lib/api/board";
import { api } from "@/lib/api/endpoints";
import type {
  Activity,
  Column,
  CustomFieldDefinition,
  CustomFieldValue,
  ExternalLink,
  Label,
  Project,
  Task,
  TaskRelation,
  TimeEntry,
} from "@/lib/api/types";
import { qk } from "@/lib/query";

export type TaskDetail = {
  task: Task;
  description: string;
  project: Project | null;
  columns: Column[];
  labels: Label[];
};

export type TaskExtras = {
  activities: Activity[];
  timeEntries: TimeEntry[];
  relations: TaskRelation[];
  links: ExternalLink[];
  fields: CustomFieldDefinition[];
  fieldValues: CustomFieldValue[];
};

const soft = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

export function useTaskDetail(taskId: string) {
  return useQuery({
    queryKey: qk.task(taskId),
    queryFn: async (): Promise<TaskDetail> => {
      const task = await api.task(taskId);
      const [description, project, columns, labels] = await Promise.all([
        loadDescription(taskId, task.description, !!task.descriptionDeferred),
        soft(api.project(task.projectId), null),
        soft(api.columns(task.projectId), [] as Column[]),
        soft(api.taskLabels(taskId), [] as Label[]),
      ]);
      return {
        task,
        description,
        project,
        columns: [...columns].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0),
        ),
        labels,
      };
    },
  });
}

export function useTaskExtras(taskId: string, projectId?: string) {
  return useQuery({
    queryKey: qk.taskExtras(taskId),
    enabled: !!projectId,
    queryFn: async (): Promise<TaskExtras> => {
      const [activities, timeEntries, relations, links, fields, fieldValues] =
        await Promise.all([
          soft(api.activities(taskId), [] as Activity[]),
          soft(api.timeEntries(taskId), [] as TimeEntry[]),
          soft(api.relations(taskId), [] as TaskRelation[]),
          soft(api.externalLinks(taskId), [] as ExternalLink[]),
          soft(api.customFields(projectId!), [] as CustomFieldDefinition[]),
          soft(api.taskCustomFieldValues(taskId), [] as CustomFieldValue[]),
        ]);
      return {
        activities: [...activities].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
        timeEntries: [...timeEntries].sort((a, b) =>
          b.startTime.localeCompare(a.startTime),
        ),
        relations,
        links,
        fields: [...fields].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0),
        ),
        fieldValues,
      };
    },
  });
}

export function entrySeconds(entry: TimeEntry, now: number): number {
  if (entry.endTime && entry.duration) return entry.duration;
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function statusName(status: string, columns: Column[]): string {
  if (status === "planned") return "Planned";
  if (status === "archived") return "Archived";
  return columns.find((c) => c.slug === status)?.name ?? status;
}
