import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  storedFileTable,
  taskAttachmentTable,
  userTable,
} from "../database/schema";
import { removeFile } from "../files/controllers";
import { getLinkPreview } from "../link-preview/fetch-preview";

const attachmentColumns = {
  id: taskAttachmentTable.id,
  taskId: taskAttachmentTable.taskId,
  kind: taskAttachmentTable.kind,
  title: taskAttachmentTable.title,
  url: taskAttachmentTable.url,
  fileId: taskAttachmentTable.fileId,
  mimeType: storedFileTable.mimeType,
  size: storedFileTable.size,
  uploadedBy: storedFileTable.uploadedBy,
  createdBy: taskAttachmentTable.createdBy,
  createdByName: userTable.name,
  createdAt: taskAttachmentTable.createdAt,
};

function attachmentQuery() {
  return db
    .select(attachmentColumns)
    .from(taskAttachmentTable)
    .leftJoin(
      storedFileTable,
      eq(storedFileTable.id, taskAttachmentTable.fileId),
    )
    .leftJoin(userTable, eq(userTable.id, taskAttachmentTable.createdBy));
}

export async function listAttachments(taskId: string) {
  return attachmentQuery()
    .where(eq(taskAttachmentTable.taskId, taskId))
    .orderBy(desc(taskAttachmentTable.createdAt));
}

async function getAttachment(id: string) {
  const [row] = await attachmentQuery().where(eq(taskAttachmentTable.id, id));
  if (!row) throw new HTTPException(404, { message: "Attachment not found" });
  return row;
}

export async function attachFile(input: {
  taskId: string;
  workspaceId: string;
  userId: string;
  fileId: string;
}) {
  // Only library files ("file" kind) of this workspace; receipts stay private
  // to their expense.
  const [file] = await db
    .select({ id: storedFileTable.id, filename: storedFileTable.filename })
    .from(storedFileTable)
    .where(
      and(
        eq(storedFileTable.id, input.fileId),
        eq(storedFileTable.workspaceId, input.workspaceId),
        eq(storedFileTable.kind, "file"),
      ),
    );
  if (!file) throw new HTTPException(400, { message: "Unknown file" });

  const [created] = await db
    .insert(taskAttachmentTable)
    .values({
      taskId: input.taskId,
      workspaceId: input.workspaceId,
      kind: "file",
      fileId: file.id,
      title: file.filename,
      createdBy: input.userId,
    })
    .returning({ id: taskAttachmentTable.id });
  if (!created) {
    throw new HTTPException(500, { message: "Failed to attach the file" });
  }
  return getAttachment(created.id);
}

export async function attachLink(input: {
  taskId: string;
  workspaceId: string;
  userId: string;
  url: string;
  title?: string;
}) {
  // No title given: use the page's own, found through the same guarded
  // fetch as chat previews (it refuses private addresses and gives up fast).
  const title =
    input.title?.trim() ||
    (await getLinkPreview(input.url).catch(() => null))?.title
      ?.trim()
      .slice(0, 200) ||
    new URL(input.url).hostname;
  const [created] = await db
    .insert(taskAttachmentTable)
    .values({
      taskId: input.taskId,
      workspaceId: input.workspaceId,
      kind: "link",
      url: input.url,
      title,
      createdBy: input.userId,
    })
    .returning({ id: taskAttachmentTable.id });
  if (!created) {
    throw new HTTPException(500, { message: "Failed to add the link" });
  }
  return getAttachment(created.id);
}

export async function findTaskAttachment(taskId: string, id: string) {
  const attachment = await getAttachment(id);
  if (attachment.taskId !== taskId) {
    throw new HTTPException(404, { message: "Attachment not found" });
  }
  return attachment;
}

/** Links are just unlinked; a file is deleted from the library too. */
export async function removeAttachment(
  workspaceId: string,
  actorId: string,
  attachment: Awaited<ReturnType<typeof getAttachment>>,
) {
  if (attachment.kind === "file" && attachment.fileId) {
    const [file] = await db
      .select()
      .from(storedFileTable)
      .where(eq(storedFileTable.id, attachment.fileId));
    // Deleting the file cascades to the attachment row.
    if (file) {
      await removeFile(workspaceId, actorId, file);
      return;
    }
  }
  await db
    .delete(taskAttachmentTable)
    .where(eq(taskAttachmentTable.id, attachment.id));
}
