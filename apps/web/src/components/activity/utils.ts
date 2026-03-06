type ActivityLike = {
  type: string;
  content: string | null;
};

export function isCommentActivity(activity: ActivityLike) {
  return activity.type === "comment" && Boolean(activity.content);
}
