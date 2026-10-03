import type { z } from "zod";
import type { agentActionSchema } from "./schema";

export type AgentAction = z.infer<typeof agentActionSchema>;
// Text files attached to a run; content is untrusted user-provided data.
export type AgentAttachment = { name: string; content: string };
export type AgentSubject = {
  userId: string;
  workspaceId: string;
  projectId: string | null;
};
export type AgentSnapshot = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  userId: string | null;
  dueDate: string | null;
};
export type AgentEffect =
  | {
      kind: "task.update";
      before: AgentSnapshot;
      after: AgentSnapshot;
    }
  | {
      kind: "task.create";
      task: AgentSnapshot & {
        number: number | null;
        description: string | null;
        position: number | null;
        columnId: string | null;
        startDate: string | null;
        createdAt: string;
        updatedAt: string;
      };
    };
