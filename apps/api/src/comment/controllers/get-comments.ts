import { and, asc, eq, isNotNull } from "drizzle-orm";
import { Effect } from "effect";
import { activityTable, userTable } from "../../database/schema";
import { Database } from "../../effect/database";

const getComments = Effect.fn("comment.getComments")(function* (
  taskId: string,
) {
  const database = yield* Database;

  const comments = yield* database.query((db) =>
    db
      .select({
        id: activityTable.id,
        taskId: activityTable.taskId,
        userId: userTable.id,
        content: activityTable.content,
        createdAt: activityTable.createdAt,
        updatedAt: activityTable.updatedAt,
        userName: userTable.name,
        userImage: userTable.image,
      })
      .from(activityTable)
      .innerJoin(userTable, eq(activityTable.userId, userTable.id))
      .where(
        and(
          eq(activityTable.taskId, taskId),
          eq(activityTable.type, "comment"),
          isNotNull(activityTable.userId),
          isNotNull(activityTable.content),
        ),
      )
      .orderBy(asc(activityTable.createdAt)),
  );

  return comments.map((c) => ({
    id: c.id,
    taskId: c.taskId,
    userId: c.userId,
    content: c.content as string,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: {
      name: c.userName,
      image: c.userImage,
    },
  }));
});

export default getComments;
