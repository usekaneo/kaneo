import { and, eq, gt } from "drizzle-orm";
import db from "../database";
import { invitationTable, userTable, workspaceTable } from "../database/schema";

type RegistrationCheckResult = {
  allowed: boolean;
  reason: string;
  invitation?: {
    id: string;
    email: string;
    workspaceId: string;
    workspaceName: string;
    inviterName: string;
    expiresAt: Date;
    status: string;
  };
};

export async function checkRegistrationAllowed(
  email?: string,
  invitationId?: string,
): Promise<RegistrationCheckResult> {
  const isRegistrationDisabled = process.env.DISABLE_REGISTRATION === "true";

  if (!isRegistrationDisabled) {
    return {
      allowed: true,
      reason: "Registration is enabled",
    };
  }

  if (!invitationId && !email) {
    return {
      allowed: false,
      reason:
        "Registration is currently disabled. Please contact your administrator for an invitation.",
    };
  }

  const invitation = await findValidInvitation(email, invitationId);

  if (!invitation) {
    return {
      allowed: false,
      reason:
        "Registration is currently disabled. You need a valid invitation to create an account.",
    };
  }

  return {
    allowed: true,
    reason: "Valid invitation found",
    invitation,
  };
}

async function findValidInvitation(
  email?: string,
  invitationId?: string,
): Promise<RegistrationCheckResult["invitation"] | null> {
  const now = new Date();

  const conditions = [
    eq(invitationTable.status, "pending"),
    gt(invitationTable.expiresAt, now),
  ];

  if (invitationId) {
    conditions.push(eq(invitationTable.id, invitationId));
  }

  if (email) {
    conditions.push(eq(invitationTable.email, email.toLowerCase()));
  }

  if (!invitationId && !email) {
    return null;
  }

  const result = await db
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      workspaceId: invitationTable.workspaceId,
      workspaceName: workspaceTable.name,
      inviterName: userTable.name,
      expiresAt: invitationTable.expiresAt,
      status: invitationTable.status,
    })
    .from(invitationTable)
    .innerJoin(
      workspaceTable,
      eq(invitationTable.workspaceId, workspaceTable.id),
    )
    .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
    .where(and(...conditions))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  return row;
}

type InvitationDetails = {
  id: string;
  email: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: Date;
  status: string;
  expired: boolean;
};

type InvitationDetailsResult = {
  valid: boolean;
  invitation?: InvitationDetails;
  error?: string;
};

export async function getInvitationDetails(
  invitationId: string,
): Promise<InvitationDetailsResult> {
  const now = new Date();

  const result = await db
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      workspaceName: workspaceTable.name,
      inviterName: userTable.name,
      expiresAt: invitationTable.expiresAt,
      status: invitationTable.status,
    })
    .from(invitationTable)
    .innerJoin(
      workspaceTable,
      eq(invitationTable.workspaceId, workspaceTable.id),
    )
    .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
    .where(eq(invitationTable.id, invitationId))
    .limit(1);

  const row = result[0];
  if (!row) {
    return {
      valid: false,
      error: "Invitation not found",
    };
  }

  const expired = row.expiresAt < now;
  const isAccepted = row.status === "accepted";
  const isCanceled = row.status === "canceled";

  const baseInvitation: InvitationDetails = {
    id: row.id,
    email: row.email,
    workspaceName: row.workspaceName,
    inviterName: row.inviterName,
    expiresAt: row.expiresAt,
    status: row.status,
    expired,
  };

  if (isAccepted) {
    return {
      valid: false,
      error: "This invitation has already been accepted",
    };
  }

  if (isCanceled) {
    return {
      valid: false,
      error: "This invitation has been canceled",
    };
  }

  if (expired) {
    return {
      valid: false,
      invitation: baseInvitation,
      error: "This invitation has expired",
    };
  }

  return {
    valid: true,
    invitation: baseInvitation,
  };
}
