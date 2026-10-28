import db from "../../database";
import { listActiveSessions } from "../../sessions/list-active-sessions";
import { findAdminTargetUser } from "../find-admin-target-user";

async function listUserSessions(userId: string, adminSessionId: string | null) {
  await findAdminTargetUser(db, userId);
  return listActiveSessions(userId, adminSessionId);
}

export default listUserSessions;
