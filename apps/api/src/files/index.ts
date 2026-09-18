import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../audit/record-audit";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import {
  FILE_SECURITY_HEADERS,
  openBlob,
  safeDisposition,
  servedType,
} from "../storage/workspace-storage";
import { limitBody } from "../utils/limit-body";
import { normalizeApiServerUrl } from "../utils/openapi-spec";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  connectStorage,
  createFolder,
  deleteFolder,
  disconnectStorage,
  fileRow,
  findFile,
  findShared,
  folderIsOwnedBy,
  listAllFolders,
  listFiles,
  moveFolder,
  normalizeFolder,
  presentFile,
  removeFile,
  shareFile,
  storageStatus,
  unshareFile,
  updateFile,
  uploadFile,
} from "./controllers";

const tags = ["Files"];
const workspaceQuery = z.object({ workspaceId: z.string() });
const idParam = z.object({ id: z.string() });
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const storageSchema = z
  .object({
    connected: z.boolean(),
    endpoint: z.string().nullable(),
    bucket: z.string().nullable(),
    region: z.string().nullable(),
    accessKeyId: z.string().nullable(),
    keyPrefix: z.string().nullable(),
    updatedAt: nullableResponseTimestamp,
  })
  .openapi("FileStorage");

const fileSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    folder: z.string(),
    storage: z.string().openapi({ description: "`s3` (R2) or `db`" }),
    uploadedBy: z.string().nullable(),
    uploadedByName: z.string().nullable(),
    publicUrl: z.string().nullable().openapi({
      description: "The live link while the file is shared, otherwise null.",
    }),
    createdAt: responseTimestamp,
  })
  .openapi("WorkspaceFile");

const folderSchema = z
  .object({
    name: z.string(),
    path: z.string().openapi({ example: "Design/Logos/" }),
    fileCount: z
      .number()
      .openapi({ description: "Files anywhere inside, sub-folders included." }),
  })
  .openapi("WorkspaceFolder");

const listSchema = z
  .object({
    folder: z.string(),
    folders: z.array(folderSchema),
    files: z.array(fileSchema),
  })
  .openapi("WorkspaceFileList");

const folderPathSchema = z.object({ path: z.string() }).openapi("FolderPath");

const settingsGuard = requireWorkspacePermission({
  workspace: ["manage_settings"],
});

const getStorageRoute = createRoute({
  method: "get",
  operationId: "getFileStorage",
  path: "/storage",
  tags,
  summary: "File storage settings",
  description:
    "Whether a Cloudflare R2 (or other S3-compatible) bucket is connected. The secret key is never returned.",
  middleware: [workspaceAccess.fromQuery(), settingsGuard] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Storage", storageSchema),
    403: errorResponse("Missing workspace:manage_settings"),
  },
});

const connectStorageRoute = createRoute({
  method: "put",
  operationId: "connectFileStorage",
  path: "/storage",
  tags,
  summary: "Connect a bucket",
  description:
    "Save R2 credentials after checking Kaneo can write to the bucket. Leave the secret empty to keep the saved one. Audit logged.",
  middleware: [workspaceAccess.fromBody(), settingsGuard] as const,
  request: {
    body: json(
      z.object({
        workspaceId: z.string(),
        endpoint: z.string().url().openapi({
          example: "https://<account-id>.r2.cloudflarestorage.com",
        }),
        bucket: z.string().trim().min(3).max(63),
        region: z.string().trim().max(40).optional(),
        accessKeyId: z.string().trim().min(1).max(200),
        secretAccessKey: z.string().trim().max(400).optional(),
        keyPrefix: z
          .string()
          .trim()
          .max(100)
          .regex(/^[A-Za-z0-9._/-]*$/)
          .optional(),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Connected", storageSchema),
    400: errorResponse("The bucket could not be written to"),
    403: errorResponse("Missing workspace:manage_settings"),
  },
});

const disconnectStorageRoute = createRoute({
  method: "delete",
  operationId: "disconnectFileStorage",
  path: "/storage",
  tags,
  summary: "Disconnect the bucket",
  description:
    "Go back to storing files in Postgres. Refused while files still live in the bucket.",
  middleware: [workspaceAccess.fromQuery(), settingsGuard] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Disconnected", storageSchema),
    409: errorResponse("Files still live in the bucket"),
  },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listFiles",
  path: "/",
  tags,
  summary: "List files",
  description: "Files and sub-folders in a folder of the workspace.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: {
    query: workspaceQuery.extend({
      folder: z.string().optional().openapi({ example: "Design/Logos/" }),
    }),
  },
  responses: {
    200: jsonResponse("Files", listSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const uploadRoute = createRoute({
  method: "put",
  operationId: "uploadFile",
  path: "/upload",
  tags,
  summary: "Upload a file",
  description:
    "Send the raw file as the body. Up to 25 MB with R2 connected, 10 MB otherwise.",
  middleware: [
    // The per-workspace limit (10 or 25 MB) is checked after; this stops
    // anything bigger before it is buffered.
    limitBody(25 * 1024 * 1024 + 1024),
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ file: ["upload"] }),
  ] as const,
  request: {
    query: workspaceQuery.extend({
      name: z.string().trim().min(1).max(200),
      folder: z.string().optional(),
    }),
    body: {
      required: true,
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("The stored file", fileSchema),
    403: errorResponse("Missing file:upload"),
    413: errorResponse("Too large"),
  },
});

const allFoldersRoute = createRoute({
  method: "get",
  operationId: "listFileFolders",
  path: "/folders",
  tags,
  summary: "List every folder",
  description: "All folder paths in the workspace, for picking where to move.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse(
      "Folders",
      z.object({ folders: z.array(z.string()) }).openapi("FileFolderList"),
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const createFolderRoute = createRoute({
  method: "post",
  operationId: "createFileFolder",
  path: "/folders",
  tags,
  summary: "Create a folder",
  description: "An empty folder stays visible until someone deletes it.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ file: ["upload"] }),
  ] as const,
  request: {
    body: json(
      z.object({
        workspaceId: z.string(),
        parent: z.string().optional().openapi({ example: "Design/" }),
        name: z.string().trim().min(1).max(80),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Created", folderPathSchema),
    400: errorResponse("That folder name isn't allowed"),
    403: errorResponse("Missing file:upload"),
    409: errorResponse("A folder with that name already exists"),
  },
});

const moveFolderRoute = createRoute({
  method: "patch",
  operationId: "moveFileFolder",
  path: "/folders",
  tags,
  summary: "Rename or move a folder",
  description:
    "Moves everything inside along with it. Folders holding only your own files, or any with file:manage (then audit logged).",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    body: json(
      z.object({
        workspaceId: z.string(),
        from: z.string().min(1).openapi({ example: "Design/Logos/" }),
        to: z.string().min(1).openapi({ example: "Brand/Logos/" }),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Moved", folderPathSchema),
    400: errorResponse("Invalid destination"),
    403: errorResponse("Holds other people's files, and missing file:manage"),
    409: errorResponse("A folder with that name already exists there"),
  },
});

const deleteFolderRoute = createRoute({
  method: "delete",
  operationId: "deleteFileFolder",
  path: "/folders",
  tags,
  summary: "Delete an empty folder",
  description: "Refused while files are still inside.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery.extend({ path: z.string().min(1) }) },
  responses: {
    200: jsonResponse("Deleted", folderPathSchema),
    403: errorResponse("Created by someone else, and missing file:manage"),
    409: errorResponse("Files are still inside"),
  },
});

const updateFileRoute = createRoute({
  method: "patch",
  operationId: "updateFile",
  path: "/{id}",
  tags,
  summary: "Rename or move a file",
  description: "Your own files, or any with file:manage.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: idParam,
    body: json(
      z.object({
        workspaceId: z.string(),
        filename: z.string().trim().min(1).max(200).optional(),
        folder: z.string().optional().openapi({ example: "Design/Logos/" }),
      }),
    ),
  },
  responses: {
    200: jsonResponse("The file", fileSchema),
    403: errorResponse("Not your file, and missing file:manage"),
    404: errorResponse("Not found"),
  },
});

const downloadRoute = createRoute({
  method: "get",
  operationId: "downloadFile",
  path: "/{id}/download",
  tags,
  summary: "Download a file",
  description:
    "Redirects to a short-lived bucket link, or returns the bytes when stored in Postgres.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: idParam, query: workspaceQuery },
  responses: {
    200: {
      description: "The file",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    302: { description: "Redirect to the stored object" },
    404: errorResponse("Not found"),
  },
});

const shareRoute = createRoute({
  method: "post",
  operationId: "shareFile",
  path: "/{id}/share",
  tags,
  summary: "Create a live link",
  description:
    "A public link anyone can open without signing in, until it is revoked. Your own files, or any with file:manage.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceQuery) },
  responses: {
    200: jsonResponse("The file with its link", fileSchema),
    403: errorResponse("Not your file, and missing file:manage"),
  },
});

const unshareRoute = createRoute({
  method: "delete",
  operationId: "unshareFile",
  path: "/{id}/share",
  tags,
  summary: "Revoke the live link",
  description: "The public link stops working immediately.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: idParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The file", fileSchema),
    403: errorResponse("Not your file, and missing file:manage"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteFile",
  path: "/{id}",
  tags,
  summary: "Delete a file",
  description: "Your own files, or any with file:manage (then audit logged).",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: idParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("Deleted", z.object({ id: z.string() })),
    403: errorResponse("Not your file, and missing file:manage"),
  },
});

const publicRoute = createRoute({
  method: "get",
  operationId: "openSharedFile",
  path: "/public/{token}",
  tags,
  summary: "Open a live link",
  description:
    "Public. Redirects to the file (R2) or returns it (Postgres) while the link is active.",
  request: { params: z.object({ token: z.string().min(16).max(64) }) },
  responses: {
    200: {
      description: "The file",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    302: { description: "Redirect to the stored object" },
    404: errorResponse("No such link, or it was revoked"),
  },
});

function publicBase(requestUrl: string) {
  return normalizeApiServerUrl(
    process.env.KANEO_API_URL || new URL(requestUrl).origin,
  );
}

async function assertOwnOrManage(c: Context, uploadedBy: string | null) {
  if (uploadedBy && uploadedBy === c.get("userId")) return;
  if (await hasWorkspacePermission(c, { file: ["manage"] })) return;
  throw new HTTPException(403, {
    message: "Only the person who uploaded it, or an admin, can do that",
  });
}

/** True when the change is someone else's content and should be audited. */
async function assertCanChangeFolder(
  c: Context,
  workspaceId: string,
  path: string,
) {
  if (await folderIsOwnedBy(workspaceId, path, c.get("userId"))) return false;
  if (await hasWorkspacePermission(c, { file: ["manage"] })) return true;
  throw new HTTPException(403, {
    message: "This folder holds other people's files; an admin can change it",
  });
}

async function sendFile(
  c: Context,
  file: Parameters<typeof openBlob>[0],
): Promise<Response> {
  const opened = await openBlob(file);
  if ("redirect" in opened) return c.redirect(opened.redirect, 302);
  return c.body(new Uint8Array(opened.bytes), 200, {
    "Content-Type": servedType(file.mimeType),
    "Content-Length": String(file.size),
    "Content-Disposition": safeDisposition(file.mimeType, file.filename),
    ...FILE_SECURITY_HEADERS,
    "Cache-Control": "private, max-age=300",
  });
}

const files = apiRouter()
  .openapi(getStorageRoute, async (c) =>
    c.json(await storageStatus(c.req.valid("query").workspaceId), 200),
  )
  .openapi(connectStorageRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(
      await connectStorage(workspaceId, c.get("userId"), input),
      200,
    );
  })
  .openapi(disconnectStorageRoute, async (c) =>
    c.json(
      await disconnectStorage(
        c.req.valid("query").workspaceId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(listRoute, async (c) => {
    const { workspaceId, folder } = c.req.valid("query");
    const result = await listFiles(workspaceId, normalizeFolder(folder));
    const base = publicBase(c.req.url);
    return c.json(
      { ...result, files: result.files.map((f) => presentFile(f, base)) },
      200,
    );
  })
  .openapi(allFoldersRoute, async (c) =>
    c.json(
      { folders: await listAllFolders(c.req.valid("query").workspaceId) },
      200,
    ),
  )
  .openapi(createFolderRoute, async (c) => {
    const { workspaceId, parent, name } = c.req.valid("json");
    return c.json(
      await createFolder(
        workspaceId,
        c.get("userId"),
        normalizeFolder(parent),
        name,
      ),
      200,
    );
  })
  .openapi(moveFolderRoute, async (c) => {
    const body = c.req.valid("json");
    const from = normalizeFolder(body.from);
    const to = normalizeFolder(body.to);
    if (!to) throw new HTTPException(400, { message: "Pick a destination" });
    const audited = await assertCanChangeFolder(c, body.workspaceId, from);
    const result = await moveFolder(
      body.workspaceId,
      c.get("userId"),
      from,
      to,
    );
    if (audited) {
      await recordAudit({
        workspaceId: body.workspaceId,
        actorId: c.get("userId"),
        action: "folder.moved",
        targetType: "folder",
        targetId: from,
        data: { from, to },
      });
    }
    return c.json(result, 200);
  })
  .openapi(deleteFolderRoute, async (c) => {
    const { workspaceId, path } = c.req.valid("query");
    const folder = normalizeFolder(path);
    if (!folder) throw new HTTPException(400, { message: "Pick a folder" });
    await assertCanChangeFolder(c, workspaceId, folder);
    return c.json(await deleteFolder(workspaceId, folder), 200);
  })
  .openapi(updateFileRoute, async (c) => {
    const { workspaceId, filename, folder } = c.req.valid("json");
    const file = await findFile(workspaceId, c.req.valid("param").id);
    await assertOwnOrManage(c, file.uploadedBy);
    return c.json(
      presentFile(
        await updateFile(file.id, {
          filename,
          folder: folder === undefined ? undefined : normalizeFolder(folder),
        }),
        publicBase(c.req.url),
      ),
      200,
    );
  })
  .openapi(uploadRoute, async (c) => {
    const { workspaceId, name, folder } = c.req.valid("query");
    const bytes = Buffer.from(await c.req.arrayBuffer());
    const id = await uploadFile({
      workspaceId,
      userId: c.get("userId"),
      filename: name,
      mimeType: c.req.header("Content-Type")?.split(";")[0]?.trim() ?? "",
      folder: normalizeFolder(folder),
      bytes,
    });
    return c.json(presentFile(await fileRow(id), publicBase(c.req.url)), 200);
  })
  .openapi(downloadRoute, async (c) => {
    const file = await findFile(
      c.req.valid("query").workspaceId,
      c.req.valid("param").id,
    );
    return sendFile(c, file);
  })
  .openapi(shareRoute, async (c) => {
    const file = await findFile(
      c.req.valid("json").workspaceId,
      c.req.valid("param").id,
    );
    await assertOwnOrManage(c, file.uploadedBy);
    return c.json(
      presentFile(await shareFile(file.id), publicBase(c.req.url)),
      200,
    );
  })
  .openapi(unshareRoute, async (c) => {
    const file = await findFile(
      c.req.valid("query").workspaceId,
      c.req.valid("param").id,
    );
    await assertOwnOrManage(c, file.uploadedBy);
    return c.json(
      presentFile(await unshareFile(file.id), publicBase(c.req.url)),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    const file = await findFile(workspaceId, c.req.valid("param").id);
    await assertOwnOrManage(c, file.uploadedBy);
    await removeFile(workspaceId, c.get("userId"), file);
    return c.json({ id: file.id }, 200);
  })
  .openapi(publicRoute, async (c) => {
    const file = await findShared(c.req.valid("param").token);
    if (!file) {
      throw new HTTPException(404, {
        message: "This link doesn't exist or was turned off",
      });
    }
    return sendFile(c, file);
  });

export default files;
