import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { agentDeviceTable, workspaceUserTable } from "../database/schema";

export const DEVICE_TOKEN_PREFIX = "kad_";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function newDeviceToken() {
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

// Unambiguous alphabet (no 0/O, 1/I/L) so a code read off a screen types
// cleanly; 8 characters is ~40 bits, enough for a 10 minute, single-use code.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newPairingCode() {
  const bytes = randomBytes(8);
  const chars = Array.from(
    bytes,
    (b) => CODE_ALPHABET[b % CODE_ALPHABET.length],
  );
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export function normalizePairingCode(code: string) {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : null;
}

export type AuthenticatedDevice = typeof agentDeviceTable.$inferSelect;

/**
 * Authenticates desktop agent requests. The device token only works on
 * /api/agent/device/* routes, stops working when the device is revoked, and
 * stops working when its owner leaves the workspace.
 */
export async function authenticateDevice(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
    throw new HTTPException(401, { message: "Device token required" });
  }

  const hash = hashSecret(token);
  const [row] = await db
    .select({ device: agentDeviceTable, memberId: workspaceUserTable.id })
    .from(agentDeviceTable)
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, agentDeviceTable.workspaceId),
        eq(workspaceUserTable.userId, agentDeviceTable.userId),
      ),
    )
    .where(
      and(
        eq(agentDeviceTable.tokenHash, hash),
        isNull(agentDeviceTable.revokedAt),
      ),
    );

  // The lookup is by SHA-256 of a random 256-bit token, so matching in the
  // database leaks nothing useful about other tokens.
  if (!row?.memberId) {
    // Its owner left the workspace: revoke for good, so rejoining later
    // doesn't quietly bring an old device back.
    if (row) {
      await db
        .update(agentDeviceTable)
        .set({ revokedAt: new Date() })
        .where(eq(agentDeviceTable.id, row.device.id));
    }
    throw new HTTPException(401, { message: "Device is not paired" });
  }

  c.set("device", row.device);
  c.set("userId", row.device.userId);
  c.set("workspaceId", row.device.workspaceId);
  await next();
}
