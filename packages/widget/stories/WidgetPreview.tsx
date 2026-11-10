import { useEffect, useRef, useState } from "react";
import { WidgetView, type WidgetTab } from "../src/ui/index.js";
import { createLauncher, type LauncherHandle } from "../src/core/launcher.js";
import { removeStyles } from "../src/core/style.js";
import { demoArticles, demoFeedback, demoUpdates } from "./demo-data.js";
import { createMockBackend } from "./mock-backend.js";
import { useMockWidget } from "./useMockWidget.js";
import "../src/ui/styles.css";

export interface WidgetPreviewProps {
  initialTab: WidgetTab;
  theme: "light" | "dark" | "auto";
  placement: "left" | "right";
  empty: boolean;
  failSubmission: boolean;
  longContent?: boolean;
  pendingSubmission?: boolean;
  withConversation?: boolean;
  loadFailure?: boolean;
  offline?: boolean;
  latency?: number;
}

export function WidgetPreview({
  initialTab,
  theme,
  placement,
  empty,
  failSubmission,
  longContent = false,
  pendingSubmission = false,
  withConversation = false,
  loadFailure = false,
  offline = false,
  latency = 250,
}: WidgetPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(true);
  const [visitor, setVisitor] = useState("anonymous");
  const [connection, setConnection] = useState<
    "online" | "offline" | "reconnecting"
  >(offline ? "offline" : "online");
  const [controlError, setControlError] = useState("");
  const [backend] = useState(() =>
    createMockBackend(
      {
        feedback: empty
          ? []
          : longContent
            ? demoFeedback.map((post) => ({
                ...post,
                title: `${post.title}: ${"LongUnbrokenTitle".repeat(8)}`,
                author: "A visitor with a very long display name",
              }))
            : demoFeedback,
        articles: empty
          ? []
          : longContent
            ? demoArticles.map((article) => ({
                ...article,
                category: `An extended category name: ${article.category}`,
                title: `${article.title}: ${"LongUnbrokenTitle".repeat(8)}`,
              }))
            : demoArticles,
        updates: empty
          ? []
          : longContent
            ? demoUpdates.map((entry) => ({
                ...entry,
                title: `${entry.title}: ${"LongUnbrokenTitle".repeat(8)}`,
                body: `${entry.body}\n\n${"A longer release note with more detail. ".repeat(30)}`,
                author: "The Quills team with a long display name",
              }))
            : demoUpdates,
        conversations:
          empty || !withConversation
            ? []
            : [
                {
                  id: "welcome-conversation",
                  title: "Getting started with feedback",
                  unreadCount: 1,
                  messages: [
                    {
                      id: "first-question",
                      body: "How do I follow a request?",
                      author: "You",
                      fromVisitor: true,
                      sentAt: "2026-11-08T14:00:00Z",
                    },
                    {
                      id: "first-answer",
                      body: "Open the request and select Follow request. You can unfollow it at any time.",
                      author: "Quills team",
                      fromVisitor: false,
                      sentAt: "2026-11-08T14:05:00Z",
                    },
                    {
                      id: "latest-answer",
                      body: "You can also vote for the ideas that matter to you.",
                      author: "Quills team",
                      fromVisitor: false,
                      sentAt: "2026-11-09T10:00:00Z",
                    },
                  ].flatMap((message) =>
                    longContent
                      ? Array.from({ length: 8 }, (_, index) => ({
                          ...message,
                          id: `${message.id}:${index}`,
                        }))
                      : [message],
                  ),
                },
              ],
      },
      latency,
    ),
  );
  const mock = useMockWidget(backend, visitor, loadFailure);
  const launcher = useRef<LauncherHandle | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => () => backend.dispose(), [backend]);
  useEffect(() => {
    backend.setOnline(!offline);
  }, [backend, offline]);
  useEffect(() => {
    launcher.current = createLauncher({
      placement,
      onClick: () => setOpen(true),
    });
    launcher.current.reveal();
    return () => {
      launcher.current?.remove();
      launcher.current = null;
      removeStyles();
    };
  }, [placement]);
  useEffect(() => {
    launcher.current?.setOpen(open);
    if (open)
      panel.current
        ?.querySelector<HTMLElement>(".qb-widget")
        ?.focus({ preventScroll: true });
    else launcher.current?.el.focus();
  }, [open, placement]);
  useEffect(() => {
    launcher.current?.setUnread(
      mock.data.conversations.reduce(
        (sum, item) => sum + (item.unreadCount ?? 0),
        0,
      ) + mock.data.updates.filter((item) => item.unread).length,
    );
  }, [mock.data, placement]);
  const control = async (action: () => Promise<unknown>) => {
    setControlError("");
    try {
      await action();
    } catch {
      if (alive.current)
        setControlError("Demo action failed. Reconnect and try again.");
    }
  };
  return (
    <main className="widget-design-preview">
      <div className="widget-design-caption">
        <strong>Quills</strong>
        <span>Interactive widget preview</span>
        <p>
          Mock backend. Data stays in memory for this story. No messages leave
          this page.
        </p>
        <div className="widget-demo-controls">
          <label>
            Demo visitor
            <select
              aria-label="Demo visitor"
              value={visitor}
              onChange={(event) => setVisitor(event.target.value)}
            >
              <option value="anonymous">Anonymous</option>
              <option value="ada">Ada</option>
            </select>
          </label>
          <button
            type="button"
            disabled={connection === "reconnecting"}
            onClick={() => {
              if (connection === "online") {
                backend.setOnline(false);
                setConnection("offline");
              } else {
                backend.setOnline(true);
                setConnection("reconnecting");
                void control(async () => {
                  try {
                    await mock.reload();
                    if (alive.current) setConnection("online");
                  } catch (error) {
                    if (alive.current) setConnection("offline");
                    throw error;
                  }
                });
              }
            }}
          >
            {connection === "online"
              ? "Go offline"
              : connection === "reconnecting"
                ? "Reconnecting…"
                : "Reconnect"}
          </button>
          <button
            type="button"
            onClick={() => {
              backend.failNext("before");
              setControlError("The next submission will fail before saving.");
            }}
          >
            Fail next submission
          </button>
          <button
            type="button"
            onClick={() => {
              backend.failNext("after");
              setControlError(
                "The next submission will save, then lose its response. Retry safely with the same draft.",
              );
            }}
          >
            Lose next response
          </button>
          <button
            type="button"
            disabled={
              !mock.data.conversations.length || connection !== "online"
            }
            onClick={() =>
              void control(() =>
                mock.perform((signal) => backend.teamReply(visitor, signal)),
              )
            }
          >
            Simulate team reply
          </button>
          <button
            type="button"
            disabled={
              !mock.data.feedback.some((post) => post.following) ||
              connection !== "online"
            }
            onClick={() => {
              const post = mock.data.feedback.find((post) => post.following);
              if (post)
                void control(() =>
                  mock.perform((signal) =>
                    backend.requestProgress(
                      visitor,
                      post.id,
                      post.status === "shipped" ? "planned" : "shipped",
                      signal,
                    ),
                  ),
                );
            }}
          >
            Simulate request progress
          </button>
          <button
            type="button"
            disabled={
              !mock.data.feedback.some((post) => post.following) ||
              connection !== "online"
            }
            onClick={() => {
              const post = mock.data.feedback.find((post) => post.following);
              if (post)
                void control(() =>
                  mock.perform(async (signal) => {
                    await backend.comment(
                      "demo-teammate",
                      post.id,
                      "Thanks for sharing this. We have an update for everyone following along.",
                      { idempotencyKey: crypto.randomUUID() },
                      signal,
                    );
                    return backend.load(visitor, signal);
                  }),
                );
            }}
          >
            Simulate request reply
          </button>
          {controlError && <p role="status">{controlError}</p>}
        </div>
      </div>
      <div
        className={`quackback-panel${open ? " quackback-open" : ""}${expanded ? " quackback-expanded" : ""}`}
        inert={!open}
        ref={panel}
      >
        <WidgetView
          key={visitor}
          theme={theme}
          initialTab={initialTab}
          onExpandedChange={setExpanded}
          attachmentsEnabled
          teamMember={{ name: "Quills team" }}
          onCommentFeedback={(id, body, options) =>
            mock.perform((signal) =>
              backend.comment(visitor, id, body, options, signal),
            )
          }
          onVoteComment={(postId, commentId, voted) =>
            mock.perform((signal) =>
              backend.voteComment(visitor, postId, commentId, voted, signal),
            )
          }
          onClose={() => setOpen(false)}
          {...mock.data}
          loadState={mock.loadState}
          connection={connection}
          onRetryLoad={mock.reload}
          teamAvailability={
            withConversation
              ? "Demo team · usually replies within a few hours"
              : undefined
          }
          onReadConversation={(id, through) =>
            mock.perform((signal) =>
              backend.readConversation(visitor, id, through, signal),
            )
          }
          onReadActivity={(id) =>
            mock.perform((signal) => backend.readActivity(visitor, id, signal))
          }
          onArticleFeedback={(id, helpful) =>
            mock.perform((signal) =>
              backend.articleFeedback(visitor, id, helpful, signal),
            )
          }
          onReadUpdate={(id) =>
            mock.perform((signal) => backend.readUpdate(visitor, id, signal))
          }
          onVoteFeedback={(id, voted) =>
            mock.perform((signal) => backend.vote(visitor, id, voted, signal))
          }
          onFollowFeedback={(id, following) =>
            mock.perform((signal) =>
              backend.follow(visitor, id, following, signal),
            )
          }
          onReactToUpdate={(id, emoji) =>
            mock.perform((signal) => backend.react(visitor, id, emoji, signal))
          }
          onShareUpdate={async () => {
            await navigator.clipboard.writeText(window.location.href);
          }}
          onSendMessage={async (body, options) => {
            if (pendingSubmission) await new Promise(() => {});
            if (failSubmission) backend.failNext("before");
            await mock.perform((signal) =>
              backend.send(visitor, body, options, signal),
            );
          }}
          onReplyMessage={async (id, body, options) => {
            if (failSubmission) backend.failNext("before");
            await mock.perform((signal) =>
              backend.reply(visitor, id, body, options, signal),
            );
          }}
          onSubmitFeedback={async (body, options) => {
            if (pendingSubmission) await new Promise(() => {});
            if (failSubmission) backend.failNext("before");
            await mock.perform((signal) =>
              backend.feedback(visitor, body, options, signal),
            );
          }}
        />
      </div>
    </main>
  );
}
