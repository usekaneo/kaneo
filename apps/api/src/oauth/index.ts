import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import * as v from "valibot";
import getIdToken from "./controllers/get-id-token";

const oauth = new Hono<{ Variables: { userId: string } }>().get(
  "/id-token",
  describeRoute({
    operationId: "getOAuthIdToken",
    tags: ["Authentication"],
    description: "Get the id_token for the current user's custom OAuth account",
    responses: {
      200: {
        description: "The id_token if available",
        content: {
          "application/json": {
            schema: resolver(v.object({ idToken: v.nullable(v.string()) })),
          },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId");
    const result = await getIdToken(userId);
    return c.json(result);
  },
);

export default oauth;
