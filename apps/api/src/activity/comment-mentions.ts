import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";

export type CommentMention = {
  userId: string;
  label: string;
};

const COMMENT_MENTION_LINK_REGEX = /\[(@[^\]]+)\]\(mention:\/\/([^)]+)\)/g;

function normalizeMentionLabel(label: string) {
  return label.replace(/^@/, "").trim().replace(/\s+/g, " ");
}

export function extractCommentMentions(content: string): CommentMention[] {
  const mentions = new Map<string, CommentMention>();

  for (const match of content.matchAll(COMMENT_MENTION_LINK_REGEX)) {
    const rawLabel = match[1];
    const rawUserId = match[2];
    const userId = rawUserId.trim().replace(/\/+$/, "");
    const label = normalizeMentionLabel(rawLabel);

    if (!userId || !label || mentions.has(userId)) {
      continue;
    }

    mentions.set(userId, { userId, label });
  }

  return [...mentions.values()];
}

export function replaceMentionLinksWithText(content: string) {
  return content.replace(COMMENT_MENTION_LINK_REGEX, (_match, rawLabel) => {
    return String(rawLabel).trim();
  });
}

export async function resolveValidTaskCommentMentions(
  taskId: string,
  content: string,
): Promise<CommentMention[]> {
  const mentions = extractCommentMentions(content);

  if (mentions.length === 0) {
    return [];
  }

  const mentionedUserIds = mentions.map((mention) => mention.userId);

  const validMembers = await db
    .select({
      userId: userTable.id,
      userName: userTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(taskTable.id, taskId),
        inArray(workspaceUserTable.userId, mentionedUserIds),
      ),
    );

  const validMemberMap = new Map(
    validMembers.map((member) => [member.userId, member.userName]),
  );

  return mentions.flatMap((mention) => {
    const validName = validMemberMap.get(mention.userId);

    if (!validName) {
      return [];
    }

    return [
      {
        userId: mention.userId,
        label: normalizeMentionLabel(validName || mention.label),
      },
    ];
  });
}
