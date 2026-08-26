import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import getBranding from "./controllers/get-branding";
import updateBranding from "./controllers/update-branding";

const hexColor = v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/));

const brandingBodySchema = v.object({
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(80))),
  logoUrl: v.optional(v.nullable(v.string())),
  logoDarkUrl: v.optional(v.nullable(v.string())),
  faviconUrl: v.optional(v.nullable(v.string())),
  primaryColor: v.optional(hexColor),
  accentColor: v.optional(v.nullable(hexColor)),
  backgroundColor: v.optional(hexColor),
  foregroundColor: v.optional(hexColor),
  cardColor: v.optional(hexColor),
  mutedColor: v.optional(hexColor),
  borderColor: v.optional(hexColor),
  sidebarBackgroundColor: v.optional(hexColor),
  sidebarForegroundColor: v.optional(hexColor),
  setupCompleted: v.optional(v.boolean()),
});

const branding = new Hono()
  .get(
    "/",
    describeRoute({
      operationId: "getInstanceBranding",
      tags: ["Branding"],
      description: "Get instance whitelabel branding (public)",
      security: [],
      responses: {
        200: {
          description: "Branding settings",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    async (c) => c.json(await getBranding()),
  )
  .put(
    "/",
    describeRoute({
      operationId: "updateInstanceBranding",
      tags: ["Branding"],
      description: "Update instance whitelabel branding (authenticated)",
      responses: {
        200: {
          description: "Updated branding",
          content: { "application/json": { schema: resolver(v.any()) } },
        },
      },
    }),
    validator("json", brandingBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      return c.json(await updateBranding(body));
    },
  );

export default branding;
