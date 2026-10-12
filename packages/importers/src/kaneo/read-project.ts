import { SourceHttpError } from "../http.js";
import type { ImportedProject, ReadProjectOptions } from "../types.js";
import { orderTasks } from "./board.js";
import type { KaneoClient, KaneoMember } from "./client.js";
import { collectLabels, mapColumns, mapRelations, mapTask } from "./mapping.js";
import { readOptional } from "./optional.js";
import { readBoard } from "./read-board.js";
import { readTaskDetails } from "./read-task-details.js";
import {
  buildWarnings,
  CUSTOM_FIELDS_UNREADABLE_WARNING,
  MEMBERS_UNAVAILABLE_WARNING,
} from "./warnings.js";

export async function readKaneoProject(
  client: KaneoClient,
  projectId: string,
  options: ReadProjectOptions,
): Promise<ImportedProject> {
  const { project, columns, tasks } = await readBoard(
    client,
    projectId,
    options.onProgress,
  );
  const warnings: string[] = [];

  const membersResult = await readOptional(() =>
    client.listMembers(project.workspaceId),
  );
  if (membersResult.status !== "ok") warnings.push(MEMBERS_UNAVAILABLE_WARNING);
  const members = new Map<string, KaneoMember>(
    membersResult.status === "ok"
      ? membersResult.value.map((member) => [member.id, member])
      : [],
  );

  const customFields = await readCustomFieldNames(client, projectId);
  if (customFields.unreadable) warnings.push(CUSTOM_FIELDS_UNREADABLE_WARNING);
  const description = project.descriptionDeferred
    ? await client.getProjectDescription(projectId)
    : project.description;

  const ordered = orderTasks(columns, tasks);
  const details = await readTaskDetails(client, ordered, {
    includeComments: options.includeComments,
    members,
    onProgress: options.onProgress,
  });
  warnings.push(...details.warnings);

  const importedColumns = mapColumns(columns);
  const columnKeys = new Set(importedColumns.map((column) => column.key));
  const importedTasks = ordered.map((task) =>
    mapTask(task, columnKeys, members, {
      description: details.descriptions.get(task.id),
      comments: details.comments.get(task.id),
    }),
  );
  const { relations, outsideProject } = mapRelations(
    details.relations,
    new Set(ordered.map((task) => task.id)),
  );

  warnings.push(
    ...buildWarnings({
      tasks: ordered,
      imported: importedTasks,
      members,
      customFieldNames: customFields.names,
      relationsOutsideProject: outsideProject,
    }),
  );

  const key = project.slug?.trim();
  return {
    name: project.name,
    ...(key ? { key } : {}),
    ...(description?.trim() ? { description } : {}),
    columns: importedColumns,
    labels: collectLabels(ordered),
    tasks: importedTasks,
    relations,
    warnings,
  };
}

async function readCustomFieldNames(
  client: KaneoClient,
  projectId: string,
): Promise<{ names: string[]; unreadable: boolean }> {
  try {
    const fields = await client.listCustomFields(projectId);
    return {
      names: fields.map((field) => field.name.trim()).filter(Boolean),
      unreadable: false,
    };
  } catch (error) {
    if (!(error instanceof SourceHttpError)) throw error;
    if (error.status === 404) return { names: [], unreadable: false };
    if (error.status === 403) return { names: [], unreadable: true };
    throw error;
  }
}
