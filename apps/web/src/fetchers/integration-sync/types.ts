import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

type CompatSyncRoute =
  (typeof client)["integration-sync"]["project"][":projectId"][":provider"];
type BindingSyncRoute =
  (typeof client)["integration-sync"]["integration"][":integrationId"];

export type SyncParams = {
  projectId: string;
  provider: InferRequestType<CompatSyncRoute["$get"]>["param"]["provider"];
  integrationId: string;
};
export type SyncRules = InferRequestType<
  BindingSyncRoute["$patch"]
>["json"]["rules"];
export type LabelRule = SyncRules["outgoing"];
export type SyncPreview = InferResponseType<BindingSyncRoute["$get"], 200>;
export type ResumePreview = InferResponseType<
  BindingSyncRoute["links"][":linkId"]["review"]["$get"],
  200
>;
