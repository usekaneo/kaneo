import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import * as v from "valibot";
import getSettings from "../utils/get-settings";

const config = new Hono().get(
  "/",
  describeRoute({
    operationId: "getConfig",
    tags: ["Config"],
    description: "Get application settings and configuration",
    responses: {
      200: {
        description: "Application settings",
        content: {
          "application/json": { schema: resolver(v.any()) },
        },
      },
    },
  }),
  async (c) => {
    const settings = getSettings();
    return c.json(settings);
  },
);

export default config;
