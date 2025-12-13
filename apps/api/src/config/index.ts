import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { configSchema } from "../schemas";
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
          "application/json": { schema: resolver(configSchema) },
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
