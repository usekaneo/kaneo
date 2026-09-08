import { apiRouter, createRoute, jsonResponse } from "../openapi";
import getIdToken from "./controllers/get-id-token";
import { idTokenSchema } from "./response";

const getIdTokenRoute = createRoute({
  method: "get",
  operationId: "getOAuthIdToken",
  path: "/id-token",
  tags: ["Authentication"],
  summary: "Get OAuth id token",
  description:
    "Get the id_token for the current user's custom OAuth account. Returns null when the user signed in another way.",
  responses: {
    200: jsonResponse("The id_token if available", idTokenSchema),
  },
});

const oauth = apiRouter().openapi(getIdTokenRoute, async (c) =>
  c.json(await getIdToken(c.get("userId")), 200),
);

export default oauth;
