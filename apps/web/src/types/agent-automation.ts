import type { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

type Automations = (typeof client)["agent"][":workspaceId"]["automations"];
export type AutomationInput = InferRequestType<Automations["$post"]>["json"];
export type AutomationListQuery = Partial<
  InferRequestType<Automations["$get"]>["query"]
>;
export type AutomationList = InferResponseType<Automations["$get"], 200>;
export type AutomationListItem = AutomationList["items"][number];
export type AgentAutomationListItem = Extract<
  AutomationListItem,
  { kind: "agent" }
>;
export type Automation = InferResponseType<
  Automations[":automationId"]["$get"],
  200
>;
export type AutomationRuns = InferResponseType<
  Automations[":automationId"]["runs"]["$get"],
  200
>;
export type AutomationTrigger = AutomationInput["trigger"];
export type AutomationOutput = AutomationInput["output"];
export type AutomationScheduleTrigger = Extract<
  Automation["trigger"],
  { type: "schedule" }
>;
export type AutomationEventTrigger = Extract<
  Automation["trigger"],
  { type: "event" }
>;
export type AutomationEventName = AutomationEventTrigger["event"];
export type AutomationRuleListItem = Extract<
  AutomationListItem,
  { kind: "rule" }
>;
export type AutomationRun = AutomationRuns[number];
export type AutomationRunTrigger = NonNullable<AutomationRun["trigger"]>;
export type AutomationPauseReason = NonNullable<Automation["pausedReason"]>;
export type AutomationSkipReason = NonNullable<Automation["lastSkipReason"]>;
