import { and, eq, ne, sql } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import getManagedProfile from "../../user/controllers/get-managed-profile";
import {
  changesManagedProfile,
  PROFILE_FIELD_MANAGED_BY_PROVIDER,
} from "../../user/managed-profile";
import { hasOtherInstanceAdmin } from "../../utils/has-other-instance-admin";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertAssignableRole } from "../roles/assert-assignable-role";
import { getUserAccess } from "../roles/get-instance-access";
import { lockAdminTargetUser } from "../users/lock-admin-target-user";
import { readAdminUser } from "../users/read-admin-user";
import { rejectSelfAction } from "../users/reject-self-action";

type UpdateUserInput = {
  userId: string;
  actorId: string;
  name?: string;
  email?: string;
  role?: string;
};

async function assertNameNotManaged(userId: string, name: string | undefined) {
  if (name === undefined) return;
  const managed = await getManagedProfile(userId);
  if (
    managed &&
    changesManagedProfile({ name }, managed.stored, managed.fields)
  )
    throw new ApiError(403, { ...PROFILE_FIELD_MANAGED_BY_PROVIDER });
}

/** Change a user's name, email, or instance role. */
async function updateUser(input: UpdateUserInput, audit: AdminAuditRequest) {
  const { userId, actorId, role } = input;
  if (role !== undefined) {
    rejectSelfAction(
      actorId,
      userId,
      "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
      "You cannot change your own role.",
    );
  }
  await assertNameNotManaged(userId, input.name);
  const actor = await getUserAccess(actorId);

  return db.transaction(async (tx) => {
    // Taken before the row lock, in the same order as the auth adapter.
    const otherAdminRemains =
      role === undefined ? true : await hasOtherInstanceAdmin(tx);
    const target = await lockAdminTargetUser(userId, tx);
    const update: Partial<typeof userTable.$inferInsert> = {};

    if (input.name !== undefined && input.name !== target.name) {
      update.name = input.name;
    }
    const email = input.email?.trim().toLowerCase();
    if (email !== undefined && email !== target.email) {
      if (email !== target.email.trim().toLowerCase()) {
        const [taken] = await tx
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(
              eq(sql`lower(${userTable.email})`, email),
              ne(userTable.id, userId),
            ),
          )
          .limit(1);
        if (taken) {
          throw new ApiError(409, {
            code: "USER_ALREADY_EXISTS",
            message: "A user with this email address already exists.",
          });
        }
        // A new address has to be confirmed again.
        update.emailVerified = false;
      }
      update.email = email;
    }
    if (role !== undefined && role !== target.role) {
      await assertAssignableRole(role, actor, tx);
      if (
        hasInstanceAdminRole(target.role) &&
        !hasInstanceAdminRole(role) &&
        !otherAdminRemains
      ) {
        throw new ApiError(400, {
          code: "CANNOT_REMOVE_LAST_ADMIN",
          message: "The instance must have at least one administrator.",
        });
      }
      update.role = role;
    }

    if (Object.keys(update).length > 0) {
      await tx.update(userTable).set(update).where(eq(userTable.id, userId));
      await recordUserUpdate(target, update, audit, tx);
    }
    return readAdminUser(userId, tx);
  });
}

async function recordUserUpdate(
  target: Awaited<ReturnType<typeof lockAdminTargetUser>>,
  update: Partial<typeof userTable.$inferInsert>,
  audit: AdminAuditRequest,
  tx: Parameters<typeof recordAdminAction>[1],
) {
  const about = {
    targetType: "user",
    targetId: target.id,
    targetLabel: update.email ?? target.email,
  };
  if (update.role !== undefined) {
    await recordAdminAction(
      {
        ...audit,
        ...about,
        action: "user.role_changed",
        metadata: { from: target.role, to: update.role },
      },
      tx,
    );
  }
  const fields = (["name", "email", "emailVerified"] as const).filter(
    (field) => update[field] !== undefined,
  );
  if (fields.length > 0) {
    await recordAdminAction(
      {
        ...audit,
        ...about,
        action: "user.updated",
        metadata: {
          fields,
          changes: Object.fromEntries(
            fields.map((field) => [
              field,
              { from: target[field], to: update[field] },
            ]),
          ),
        },
      },
      tx,
    );
  }
}

export default updateUser;
