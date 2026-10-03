import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type AgentClient = (typeof client)["agent"][":workspaceId"];

export type AgentConversation = InferResponseType<
  AgentClient["conversations"]["$get"],
  200
>[number];
export type AgentRun = InferResponseType<
  AgentClient["runs"][":runId"]["$get"],
  200
>;
export type AgentRunSummary = InferResponseType<
  AgentClient["conversations"][":conversationId"]["runs"]["$get"],
  200
>[number];
export type RecentAgentRun = InferResponseType<
  AgentClient["runs"]["$get"],
  200
>[number];
export type AgentStep = AgentRun["steps"][number];
export type AgentProposal = AgentRun["proposals"][number];
export type AgentRunStatus = AgentRun["status"];
