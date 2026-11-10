import Quackback, { type EventMap, type WidgetUser } from "@quackback/widget";
import {
  useQuackback,
  useQuackbackInit,
  useQuackbackEvent,
} from "@quackback/widget/react";
import { SDK_VERSION } from "@quackback/widget/version";
import { WidgetView, type WidgetViewProps } from "@quackback/widget/ui";

const viewProps: WidgetViewProps = { onClose: () => {}, initialTab: "home" };
const recordReturningAction: WidgetViewProps["onSubmitFeedback"] =
  async () => ({ id: "saved" });
void recordReturningAction;
const legacyOneArgumentAction: WidgetViewProps["onSendMessage"] = async (
  body: string,
) => ({ body });
const replyAction: WidgetViewProps["onReplyMessage"] = async (
  conversationId,
  body,
  options,
) => {
  options.idempotencyKey satisfies string;
  return { conversationId, body };
};
const voteAction: WidgetViewProps["onVoteFeedback"] = async (
  _postId,
  voted,
) => {
  voted satisfies boolean;
};
void legacyOneArgumentAction;
void replyAction;
void voteAction;
({
  id: "p",
  title: "Idea",
  body: "",
  author: "Ada",
  votes: 1,
  // @ts-expect-error A status must use the documented vocabulary.
  status: "done",
}) satisfies NonNullable<WidgetViewProps["feedback"]>[number];
WidgetView satisfies (props: WidgetViewProps) => unknown;
void viewProps;
// @ts-expect-error A close handler is required for an accessible panel.
({ initialTab: "home" }) satisfies WidgetViewProps;

export function useConsumer() {
  const sdk: typeof Quackback = useQuackback();
  sdk.init({
    instanceUrl: "https://feedback.example.com",
    identity: { id: "a", email: "a@example.com" },
  });
  useQuackbackInit({
    instanceUrl: "https://feedback.example.com",
    shouldInitialize: false,
  });
  useQuackbackEvent("vote", (payload: EventMap["vote"]) => {
    payload.voted satisfies boolean;
  });
  const user: WidgetUser | null = sdk.getUser();
  SDK_VERSION satisfies string;
  user?.id satisfies string | undefined;
  sdk.open({ articleId: "article_saved" });
  ({}) satisfies EventMap["ready"];
  // @ts-expect-error Ready events carry an empty object, not a scalar.
  42 satisfies EventMap["ready"];
  // @ts-expect-error Unread is a number, not a string.
  sdk.on("unread", (payload: { count: string }) => {
    void payload;
  });
  // @ts-expect-error Unknown views are not part of the public API.
  sdk.open({ view: "unknown" });
}
