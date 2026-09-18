import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { expenseTable, storedFileTable } from "../database/schema";
import { storeBlob } from "../storage/workspace-storage";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

// Receipts are photos or PDFs. The type is decided from the bytes, not from
// what the browser claims, so an HTML file can't be stored as a "receipt".
function sniff(bytes: Buffer): string | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

export async function storeReceipt(
  workspaceId: string,
  userId: string,
  filename: string,
  base64: string,
) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) {
    throw new HTTPException(400, { message: "The file is empty" });
  }
  if (bytes.length > MAX_RECEIPT_BYTES) {
    throw new HTTPException(413, { message: "Receipts can be at most 5 MB" });
  }
  const mimeType = sniff(bytes);
  if (!mimeType) {
    throw new HTTPException(400, {
      message: "Receipts must be a PNG, JPEG, GIF, WebP image or a PDF",
    });
  }

  // Postgres by default, the workspace's R2 bucket once one is connected.
  return storeBlob({
    workspaceId,
    uploadedBy: userId,
    filename,
    mimeType,
    bytes,
    kind: "receipt",
  });
}

export async function readReceipt(workspaceId: string, id: string) {
  const [file] = await db
    .select()
    .from(storedFileTable)
    .where(
      and(
        eq(storedFileTable.id, id),
        eq(storedFileTable.workspaceId, workspaceId),
        eq(storedFileTable.kind, "receipt"),
      ),
    );
  if (!file) {
    throw new HTTPException(404, { message: "File not found" });
  }
  return file;
}

/** Who a receipt is about: the expense owner, if it is attached to one. */
export async function receiptOwner(fileId: string) {
  const [expense] = await db
    .select({ userId: expenseTable.userId })
    .from(expenseTable)
    .where(eq(expenseTable.receiptFileId, fileId));
  return expense?.userId ?? null;
}
