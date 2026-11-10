import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { HomeView } from "./HomeView.js";
import { MessagesView } from "./MessagesView.js";
import { HelpView } from "./HelpView.js";
import { FeedbackView } from "./FeedbackView.js";
import { FeedbackDetail } from "./FeedbackDetail.js";
import { UpdatesView } from "./UpdatesView.js";
import { UpdateDetail } from "./UpdateDetail.js";
import { safeMediaUrl } from "./media.js";
import { Composer } from "./Composer.js";
import { ConversationView } from "./ConversationView.js";
import { ActivityView } from "./ActivityView.js";
import { ArticleView } from "./ArticleView.js";
import { ConnectionStatus } from "./ConnectionStatus.js";
import { useDrafts, emptyDraft } from "./useDrafts.js";
import { useWidgetNavigation } from "./useWidgetNavigation.js";
import { useAction } from "./useAction.js";
import type {
  WidgetTab,
  WidgetViewProps,
  HelpFilters,
  FeedbackFilters,
} from "./types.js";

const tabs: { id: WidgetTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "messages", label: "Messages" },
  { id: "help", label: "Help" },
  { id: "feedback", label: "Feedback" },
  { id: "updates", label: "Updates" },
];

export function WidgetView({
  brandName = "Quills",
  theme = "auto",
  initialTab = "home",
  feedback = [],
  articles = [],
  updates = [],
  conversations = [],
  activities = [],
  onReadActivity,
  onArticleFeedback,
  loadState = "ready",
  connection = "online",
  onRetryLoad,
  teamAvailability,
  teamMember,
  attachmentsEnabled,
  onCaptureScreenshot,
  onExpandedChange,
  onCommentFeedback,
  onVoteComment,
  onClose,
  onSendMessage,
  onSubmitFeedback,
  onReplyMessage,
  onReadConversation,
  onReadUpdate,
  onVoteFeedback,
  onFollowFeedback,
  onReactToUpdate,
  onShareUpdate,
}: WidgetViewProps) {
  const [attachmentReset, setAttachmentReset] = useState(0);
  const close = () => {
    nav.content.current
      ?.querySelectorAll("dialog")
      .forEach((dialog) => dialog.close());
    setAttachmentReset((value) => value + 1);
    onClose();
  };
  const nav = useWidgetNavigation(initialTab);
  const { tab, detail: selected, composer } = nav.route;
  const composeKey = nav.route.articleId
    ? `message:article:${nav.route.articleId}`
    : (composer ?? "");
  const contextArticle = articles.find(
    (item) => item.id === nav.route.articleId,
  );
  const expanded = !!selected && (tab === "help" || tab === "updates");
  const expansionCallback = useRef(onExpandedChange);
  useEffect(() => {
    expansionCallback.current = onExpandedChange;
  }, [onExpandedChange]);
  useEffect(() => {
    expansionCallback.current?.(expanded);
  }, [expanded]);
  useEffect(() => () => expansionCallback.current?.(false), []);
  const [notice, setNotice] = useState("");
  const [helpFilters, setHelpFilters] = useState<HelpFilters>({
    query: "",
    category: null,
  });
  const [feedbackFilters, setFeedbackFilters] = useState<FeedbackFilters>({
    query: "",
    sort: "default",
    status: "all",
  });
  const draftStore = useDrafts();
  const read = useAction();
  const readState = read.forKey(`${tab}:${selected}`);
  const offline = connection !== "online";
  const navigate = (next: WidgetTab) => {
    nav.navigate(next);
    setNotice("");
  };
  const compose = (kind: "message" | "feedback") => {
    nav.go({ tab, composer: kind });
    setNotice("");
  };
  const markConversationRead = (id: string) => {
    const item = conversations.find((item) => item.id === id);
    const last = item?.messages[item.messages.length - 1];
    if (!offline && onReadConversation && last && (item?.unreadCount ?? 0) > 0)
      void read.run(() => onReadConversation(id, last.id), `messages:${id}`);
  };
  const open = (next: WidgetTab, id: string) => {
    nav.go({ tab: next, detail: id });
    setNotice("");
    if (
      next === "updates" &&
      !offline &&
      onReadUpdate &&
      updates.find((item) => item.id === id)?.unread
    )
      void read.run(() => onReadUpdate(id), `updates:${id}`);
  };
  const article =
    tab === "help" ? articles.find((item) => item.id === selected) : undefined;
  const post =
    tab === "feedback"
      ? feedback.find((item) => item.id === selected)
      : undefined;
  const update =
    tab === "updates"
      ? updates.find((item) => item.id === selected)
      : undefined;
  const conversation =
    tab === "messages"
      ? conversations.find((item) => item.id === selected)
      : undefined;
  const unreadMessages = conversations.reduce(
    (sum, item) => sum + Math.max(0, item.unreadCount ?? 0),
    0,
  );
  const unreadUpdates = updates.filter((item) => item.unread).length;
  const submission = composer === "message" ? onSendMessage : onSubmitFeedback;
  const submit = () => {
    if (!composer || !submission || offline) return;
    const origin = nav.key;
    void draftStore.submit(
      composeKey,
      (body, options) =>
        submission(body, {
          ...options,
          ...(nav.route.articleId ? { articleId: nav.route.articleId } : {}),
        }),
      () => {
        if (nav.currentKey.current !== origin) return;
        navigate(composer === "message" ? "messages" : "feedback");
        setNotice(
          composer === "message" ? "Message sent." : "Feedback submitted.",
        );
      },
    );
  };
  return (
    <section
      className="qb-widget"
      tabIndex={-1}
      data-theme={theme}
      data-expanded={expanded}
      data-composer={composer}
      aria-label={`${brandName} support`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <header className="qb-header">
        {nav.canGoBack ? (
          <>
            <button
              type="button"
              className="qb-icon-button"
              aria-label="Back"
              onClick={() => {
                nav.back();
                setNotice("");
              }}
            >
              <Icon name="back" />
            </button>
            <strong>
              {composer === "feedback"
                ? "Give feedback"
                : post
                  ? "Request"
                  : conversation
                    ? "Conversation"
                    : ""}
            </strong>
          </>
        ) : (
          <>
            <span className="qb-brand-mark">
              <Icon name="messages" />
            </span>
            <strong>{brandName}</strong>
          </>
        )}
        {!nav.canGoBack && (!!onReadActivity || activities.length > 0) && (
          <button
            type="button"
            className="qb-icon-button qb-activity-trigger"
            aria-label={`Activity${activities.some((item) => item.unread) ? ", unread updates" : ""}`}
            onClick={() => nav.go({ tab, activity: true })}
          >
            <Icon name="inbox" />
            {activities.some((item) => item.unread) && (
              <span className="qb-unread-dot" />
            )}
          </button>
        )}
        {article?.url && safeMediaUrl(article.url) && (
          <a
            className="qb-icon-button qb-external"
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open article in new tab"
          >
            <Icon name="external" />
          </a>
        )}
        <button
          type="button"
          className="qb-icon-button qb-close"
          aria-label="Close widget"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </header>
      <ConnectionStatus
        loadState={loadState}
        connection={connection}
        onRetry={onRetryLoad}
      />
      <div className="qb-content" ref={nav.content} tabIndex={-1}>
        {notice && (
          <p className="qb-notice" role="status">
            {notice}
          </p>
        )}
        {nav.route.activity ? (
          <ActivityView
            activities={activities}
            onRead={onReadActivity}
            offline={offline}
            onOpen={(id) => open("feedback", id)}
          />
        ) : composer ? (
          <Composer
            key={composeKey}
            kind={composer}
            articleContext={contextArticle?.title}
            draft={draftStore.drafts[composeKey] ?? emptyDraft}
            onChange={(body) => draftStore.change(composeKey, body)}
            onSubmit={submission ? submit : undefined}
            offline={offline}
            articles={articles}
            posts={feedback}
            onOpenPost={(id) => open("feedback", id)}
            teamMember={teamMember}
            attachmentsEnabled={attachmentsEnabled}
            attachmentReset={attachmentReset}
            onFilesChange={(files) => draftStore.changeFiles(composeKey, files)}
            onCapture={onCaptureScreenshot}
            onOpenArticle={(id) => open("help", id)}
            onBrowseHelp={() => nav.go({ tab: "help" })}
          />
        ) : article ? (
          <ArticleView
            key={article.id}
            article={article}
            offline={offline}
            onFeedback={onArticleFeedback}
            onContact={
              onSendMessage
                ? () =>
                    nav.go({
                      tab: "messages",
                      composer: "message",
                      articleId: article.id,
                    })
                : undefined
            }
            articles={articles}
            onOpen={(id) => open("help", id)}
          />
        ) : post ? (
          <FeedbackDetail
            key={post.id}
            post={post}
            onVote={onVoteFeedback}
            onFollow={onFollowFeedback}
            onComment={onCommentFeedback}
            onVoteComment={onVoteComment}
            drafts={draftStore}
            offline={offline}
          />
        ) : update ? (
          <>
            <UpdateDetail
              entry={update}
              posts={feedback}
              onOpenPost={(id) => open("feedback", id)}
              onReact={offline ? undefined : onReactToUpdate}
              onShare={offline ? undefined : onShareUpdate}
            />
            {update.unread && onReadUpdate && (
              <button
                type="button"
                className="qb-text-button"
                disabled={offline || readState.pending}
                onClick={() =>
                  void read.run(
                    () => onReadUpdate(update.id),
                    `updates:${update.id}`,
                  )
                }
              >
                Mark update as read
              </button>
            )}
            {readState.error && (
              <p role="alert" className="qb-form-error">
                {readState.error}
              </p>
            )}
          </>
        ) : conversation ? (
          <ConversationView
            key={conversation.id}
            scrollContainer={nav.content}
            conversation={conversation}
            attachmentsEnabled={attachmentsEnabled}
            attachmentReset={attachmentReset}
            onFilesChange={(files) =>
              draftStore.changeFiles(`reply:${conversation.id}`, files)
            }
            offline={offline}
            draft={draftStore.drafts[`reply:${conversation.id}`] ?? emptyDraft}
            onChange={(body) =>
              draftStore.change(`reply:${conversation.id}`, body)
            }
            onReply={
              onReplyMessage
                ? () => {
                    if (offline) return;
                    void draftStore.submit(
                      `reply:${conversation.id}`,
                      (body, options) =>
                        onReplyMessage(conversation.id, body, options),
                      () => {},
                    );
                  }
                : undefined
            }
            onRead={
              onReadConversation
                ? () => markConversationRead(conversation.id)
                : undefined
            }
            reading={readState.pending}
            readError={readState.error}
          />
        ) : selected ? (
          <p className="qb-empty">This item is no longer available.</p>
        ) : loadState !== "ready" &&
          !articles.length &&
          !feedback.length &&
          !updates.length &&
          !conversations.length ? (
          <div className="qb-loading-placeholder" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : tab === "home" ? (
          <HomeView
            latest={updates.find((item) => item.unread) ?? updates[0]}
            navigate={navigate}
            compose={compose}
            openUpdate={(id) => open("updates", id)}
            conversations={conversations}
            openConversation={(id) => open("messages", id)}
            teamAvailability={teamAvailability}
          />
        ) : tab === "messages" ? (
          <MessagesView
            conversations={conversations}
            onOpen={(id) => open("messages", id)}
            onCompose={() => compose("message")}
          />
        ) : tab === "help" ? (
          <HelpView
            articles={articles}
            onOpen={(id) => open("help", id)}
            filters={helpFilters}
            onFilters={(filters) => {
              setHelpFilters(filters);
              nav.resetScroll();
            }}
          />
        ) : tab === "feedback" ? (
          <FeedbackView
            posts={feedback}
            onOpen={(id) => open("feedback", id)}
            onCompose={() => compose("feedback")}
            filters={feedbackFilters}
            onFilters={(filters) => {
              setFeedbackFilters(filters);
              if (
                filters.query !== feedbackFilters.query ||
                filters.sort !== feedbackFilters.sort ||
                filters.status !== feedbackFilters.status
              )
                nav.resetScroll();
            }}
          />
        ) : (
          <UpdatesView
            entries={updates}
            onOpen={(id) => open("updates", id)}
            onReact={offline ? undefined : onReactToUpdate}
            onShare={offline ? undefined : onShareUpdate}
          />
        )}
      </div>
      {!composer && !selected && !nav.route.activity && (
        <>
          <nav className="qb-nav" aria-label="Widget navigation">
            {tabs.map((item) => {
              const unread =
                item.id === "messages"
                  ? unreadMessages
                  : item.id === "updates"
                    ? unreadUpdates
                    : 0;
              return (
                <button
                  type="button"
                  key={item.id}
                  aria-current={tab === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <span>
                    <Icon
                      name={item.id}
                      weight={tab === item.id ? "fill" : "regular"}
                    />
                    {unread > 0 && (
                      <i
                        className="qb-nav-unread"
                        aria-label={`${unread} unread`}
                      />
                    )}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </>
      )}
      {((!selected && composer !== "feedback") || !!conversation) && (
        <footer className="qb-footer">
          Powered by <strong>Quills</strong>
        </footer>
      )}
    </section>
  );
}
