import { toIsoDate } from "../markdown.js";
import type { ImportedComment } from "../types.js";
import type { TrelloCommentAction, TrelloMember } from "./client.js";
import { trelloPerson } from "./people.js";

export function mapCommentActions(
  actions: TrelloCommentAction[],
  owner: TrelloMember,
): Map<string, ImportedComment[]> {
  const byCard = new Map<string, ImportedComment[]>();

  for (const action of oldestFirst(actions)) {
    const cardId = action.data?.card?.id;
    const body = action.data?.text;
    if (!cardId || !body?.trim()) continue;

    const author =
      trelloPerson(
        action.memberCreator ?? { id: action.idMemberCreator ?? undefined },
        owner,
      ) ?? {};
    const createdAt = toIsoDate(action.date);
    const comment: ImportedComment = {
      author,
      body,
      ...(createdAt ? { createdAt } : {}),
    };

    const comments = byCard.get(cardId);
    if (comments) comments.push(comment);
    else byCard.set(cardId, [comment]);
  }

  return byCard;
}

function oldestFirst(actions: TrelloCommentAction[]): TrelloCommentAction[] {
  return actions
    .map((action, index) => ({
      action,
      index,
      time: Date.parse(action.date ?? "") || 0,
    }))
    .sort((a, b) => a.time - b.time || b.index - a.index)
    .map(({ action }) => action);
}
