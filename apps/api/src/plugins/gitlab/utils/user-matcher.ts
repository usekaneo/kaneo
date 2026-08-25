import { sql } from "drizzle-orm";
import db from "../../../database";
import { userTable } from "../../../database/schema";
import type { createGitlabClient } from "./gitlab-api";

export async function findKaneoUserByEmail(
  emailOrUsername: string,
  name?: string,
) {
  if (!emailOrUsername?.trim()) {
    return null;
  }
  const normalized = emailOrUsername.trim().toLowerCase();

  // 1. Exact email match
  const byEmail = await db.query.userTable.findFirst({
    where: sql`LOWER(${userTable.email}) = ${normalized}`,
  });
  if (byEmail) return byEmail;

  // 2. Email prefix match (e.g. username matches 'iotech.agent' in 'iotech.agent@gmail.com')
  const prefix = normalized.split("@")[0];
  const byPrefix = await db.query.userTable.findFirst({
    where: sql`LOWER(SPLIT_PART(${userTable.email}, '@', 1)) = ${prefix}`,
  });
  if (byPrefix) return byPrefix;

  // 3. Name match if provided
  if (name?.trim()) {
    const normalizedName = name.trim().toLowerCase();
    const byName = await db.query.userTable.findFirst({
      where: sql`LOWER(${userTable.name}) = ${normalizedName}`,
    });
    if (byName) return byName;
  }

  return null;
}

export async function resolveGitlabAssigneeEmail(
  client: ReturnType<typeof createGitlabClient>,
  assignee: {
    id?: number;
    username?: string;
    email?: string;
  },
  repositoryPath?: string,
): Promise<string | null> {
  if (assignee.email?.trim()) {
    return assignee.email.trim();
  }

  if (assignee.id) {
    try {
      const user = await client.getUser(assignee.id);
      if (user?.email) return user.email.trim();
      if (user?.public_email) return user.public_email.trim();
    } catch (error) {
      console.warn("Failed to fetch GitLab user by ID for email resolution", {
        userId: assignee.id,
        error,
      });
    }
  }

  if (assignee.username) {
    try {
      const user = await client.findUserByUsername(
        assignee.username,
        repositoryPath,
      );
      if (user?.email) return user.email.trim();
      if (user?.public_email) return user.public_email.trim();
    } catch (error) {
      console.warn(
        "Failed to fetch GitLab user by username for email resolution",
        {
          username: assignee.username,
          error,
        },
      );
    }
    // Fallback to username if private email cannot be fetched
    return assignee.username.trim();
  }

  return null;
}
