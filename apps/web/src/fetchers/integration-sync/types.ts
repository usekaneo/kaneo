import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

type SyncRoute =
  (typeof client)["integration-sync"]["project"][":projectId"][":provider"];
export type SyncParams = InferRequestType<SyncRoute["$get"]>["param"];
export type SyncRules = InferRequestType<SyncRoute["$patch"]>["json"]["rules"];
export type LabelRule = SyncRules["outgoing"];
export type SyncPreview = InferResponseType<SyncRoute["$get"], 200>;
export type ResumePreview = InferResponseType<
  SyncRoute["links"][":linkId"]["review"]["$get"],
  200
>;
