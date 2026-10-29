import type { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

type AgentClient = (typeof client)["agent"][":workspaceId"];

export type AgentConversation = InferResponseType<
  AgentClient["conversations"]["$get"],
  200
>[number];
export type AgentConversationDetail = InferResponseType<
  AgentClient["conversations"][":conversationId"]["$get"],
  200
>;
export type AgentConversationOwner = AgentConversationDetail["owner"];
export type AgentRunResponse = InferResponseType<
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
type RawProposal = AgentRunResponse["proposals"][number];
export type AgentCodeProposal = Omit<RawProposal, "action"> & {
  action: Extract<RawProposal["action"], { type: "code.run" }>;
};
export type AgentProposal = Omit<RawProposal, "action"> & {
  action: Exclude<RawProposal["action"], { type: "code.run" }>;
};
// Task and comment proposals share one renderer; coding proposals have their
// own row, so the run keeps them apart.
export type AgentRun = Omit<AgentRunResponse, "proposals"> & {
  proposals: AgentProposal[];
  codeProposals: AgentCodeProposal[];
};
export type AgentCodeJob = InferResponseType<
  AgentClient["jobs"][":jobId"]["$get"],
  200
>;
export type AgentCodeRepository = InferResponseType<
  AgentClient["code"]["repositories"]["$get"],
  200
>[number];
export type AgentCodeStatus = InferResponseType<
  AgentClient["code"]["status"]["$get"],
  200
>;
export type StartAgentCodeJobInput = InferRequestType<
  AgentClient["jobs"]["$post"]
>["json"];
export type AgentRunStatus = AgentRun["status"];
export type AgentRunAttachment = AgentRunSummary["attachments"][number];
export type AgentRunAttachmentInput = NonNullable<
  InferRequestType<
    AgentClient["conversations"][":conversationId"]["runs"]["$post"]
  >["json"]["attachments"]
>[number];
export type AgentUploadMediaType = InferRequestType<
  AgentClient["attachments"]["$post"]
>["json"]["mediaType"];
export type AgentRunMentionInput = NonNullable<
  InferRequestType<
    AgentClient["conversations"][":conversationId"]["runs"]["$post"]
  >["json"]["mentions"]
>[number];
