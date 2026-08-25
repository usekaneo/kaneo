import { sql } from "drizzle-orm";
import db from "../../../database";
import { userTable } from "../../../database/schema";
import type { createGitlabClient } from "./gitlab-api";

export async function findKaneoUserByEmail(email: string) {
  if (!email?.trim()) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  const user = await db.query.userTable.findFirst({
    where: sql`LOWER(${userTable.email}) = ${normalized}`,
  });
  return user ?? null;
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
  }

  return null;
}
