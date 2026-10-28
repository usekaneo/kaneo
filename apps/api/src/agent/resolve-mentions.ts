import { and, eq, inArray, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { MentionedItem } from "./mention-context";
import type { AgentMentionRef } from "./mention-token";
import type { AgentSubject } from "./types";

const idsOf = (refs: AgentMentionRef[], type: AgentMentionRef["type"]) =>
  refs.filter((ref) => ref.type === type).map((ref) => ref.id);

// Resolves with the user's current access and the conversation's project
// scope. Anything else is dropped without a trace, so a prompt cannot probe
// whether a hidden task or project exists.
export async function resolveMentions(
  subject: AgentSubject,
  refs: AgentMentionRef[],
): Promise<MentionedItem[]> {
  const taskIds = idsOf(refs, "task");
  const projectIds = idsOf(refs, "project");
  const inScope = and(
    eq(schema.projectTable.workspaceId, subject.workspaceId),
    projectAccessCondition(subject.userId, schema.projectTable.id),
    subject.projectId
      ? eq(schema.projectTable.id, subject.projectId)
      : undefined,
  );
  const [tasks, projects] = await Promise.all([
    taskIds.length
      ? db
          .select({
            id: schema.taskTable.id,
            title: schema.taskTable.title,
            key: sql<
              string | null
            >`case when ${schema.taskTable.number} is null then null else ${schema.projectTable.slug} || '-' || ${schema.taskTable.number} end`,
            status: schema.taskTable.status,
            project: schema.projectTable.name,
          })
          .from(schema.taskTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(and(inArray(schema.taskTable.id, taskIds), inScope))
      : [],
    projectIds.length
      ? db
          .select({
            id: schema.projectTable.id,
            name: schema.projectTable.name,
            key: schema.projectTable.slug,
          })
          .from(schema.projectTable)
          .where(and(inArray(schema.projectTable.id, projectIds), inScope))
      : [],
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return refs.flatMap((ref): MentionedItem[] => {
    if (ref.type === "task") {
      const task = taskById.get(ref.id);
      return task ? [{ type: "task", ...task }] : [];
    }
    const project = projectById.get(ref.id);
    return project ? [{ type: "project", ...project }] : [];
  });
}
