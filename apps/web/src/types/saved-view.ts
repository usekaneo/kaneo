import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

type ResolvedSavedViewResponse = InferResponseType<
  (typeof client)["saved-view"]["workspace"][":workspaceId"]["project"][":projectId"]["$get"],
  200
>[number];

export type SavedViewType = ResolvedSavedViewResponse["type"];

export type ResolvedSavedView = Omit<ResolvedSavedViewResponse, "type"> & {
  type: SavedViewType;
};
