import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getLinkPreview } from "./fetch-preview";

const previewSchema = z
  .object({
    url: z.string(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    image: z.string().nullable(),
    siteName: z.string().nullable(),
    favicon: z.string().nullable(),
    youtubeId: z.string().nullable(),
  })
  .nullable()
  .openapi("LinkPreview");

const previewRoute = createRoute({
  method: "get",
  operationId: "getLinkPreview",
  path: "/",
  tags: ["Link previews"],
  summary: "Preview a link",
  description:
    "Title, description and image for a public web page, for cards under chat messages. Null when the page can't be previewed. Private and local addresses are never fetched.",
  // Workspace members only, so this isn't an open fetch proxy.
  middleware: [workspaceAccess.fromQuery()] as const,
  request: {
    query: z.object({
      workspaceId: z.string(),
      url: z
        .string()
        .url()
        .max(2048)
        .openapi({ example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    }),
  },
  responses: {
    200: jsonResponse("The preview, or null", previewSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const linkPreview = apiRouter().openapi(previewRoute, async (c) => {
  const preview = await getLinkPreview(c.req.valid("query").url);
  c.header("Cache-Control", "private, max-age=3600");
  return c.json(preview, 200);
});

export default linkPreview;
