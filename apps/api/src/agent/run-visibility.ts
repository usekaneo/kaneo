import { sql } from "drizzle-orm";
import { schema } from "../database";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { AgentSubject } from "./types";

// A viewer may see a shared run only while they can read every project it
// touched. IDs that match no project in the workspace (a deleted project, or
// "*" on runs from before tracking) never pass, so those runs stay owner-only.
export function touchedProjectsReadable(subject: AgentSubject) {
  return sql<boolean>`not exists (
    select 1 from unnest(${schema.agentRunTable.touchedProjectIds}) as touched(id)
    where not exists (
      select 1 from ${schema.projectTable}
      where ${schema.projectTable.id} = touched.id
        and ${schema.projectTable.workspaceId} = ${subject.workspaceId}
        and ${projectAccessCondition(subject.userId, schema.projectTable.id)}
    )
  )`;
}

// A shared conversation shows its header to a viewer only if it has no runs
// yet or at least one run they may see, so hidden runs cannot be inferred
// from an otherwise empty thread.
export function conversationReadable(subject: AgentSubject) {
  return sql<boolean>`(
    not exists (
      select 1 from ${schema.agentRunTable}
      where ${schema.agentRunTable.conversationId} = ${schema.agentConversationTable.id}
    )
    or exists (
      select 1 from ${schema.agentRunTable}
      where ${schema.agentRunTable.conversationId} = ${schema.agentConversationTable.id}
        and ${touchedProjectsReadable(subject)}
    )
  )`;
}
