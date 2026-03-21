import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { commentTable, userTable } from "../../database/schema";

async function getComments(taskId: string) {
  const comments = await db
    .select({
      id: commentTable.id,
      taskId: commentTable.taskId,
      userId: commentTable.userId,
      content: commentTable.content,
      createdAt: commentTable.createdAt,
      updatedAt: commentTable.updatedAt,
      userName: userTable.name,
      userImage: userTable.image,
    })
    .from(commentTable)
    .leftJoin(userTable, eq(commentTable.userId, userTable.id))
    .where(eq(commentTable.taskId, taskId))
    .orderBy(asc(commentTable.createdAt));

  return comments.map((c) => ({
    id: c.id,
    taskId: c.taskId,
    userId: c.userId,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: {
      name: c.userName ?? "",
      image: c.userImage,
    },
  }));
}

export default getComments;
