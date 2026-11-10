import { useId, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import { Avatar } from "./Avatar.js";
import { AttachmentControls } from "./AttachmentControls.js";
import { suggestArticles, suggestFeedback } from "./search.js";
import type {
  FeedbackPost,
  HelpArticle,
  WidgetPerson,
  WidgetViewProps,
} from "./types.js";
import type { Draft } from "./useDrafts.js";

export function Composer({
  kind,
  draft,
  onChange,
  onSubmit,
  articles = [],
  posts = [],
  onOpenArticle,
  onOpenPost,
  onBrowseHelp,
  offline = false,
  teamMember,
  attachmentsEnabled = false,
  attachmentReset,
  onFilesChange,
  onCapture,
  articleContext,
}: {
  kind: "message" | "feedback" | "reply" | "comment";
  draft: Draft;
  onChange: (body: string) => void;
  onSubmit?: () => void;
  articles?: readonly HelpArticle[];
  posts?: readonly FeedbackPost[];
  onOpenArticle?: (id: string) => void;
  onOpenPost?: (id: string) => void;
  onBrowseHelp?: () => void;
  offline?: boolean;
  teamMember?: WidgetPerson;
  attachmentsEnabled?: boolean;
  attachmentReset?: number;
  onFilesChange?: (files: readonly File[]) => void;
  onCapture?: WidgetViewProps["onCaptureScreenshot"];
  articleContext?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const fieldId = useId();
  const [preparing, setPreparing] = useState(false);
  const { body, pending, error, files } = draft;
  const compact = kind === "reply" || kind === "comment";
  const label =
    kind === "feedback"
      ? "Your feedback"
      : kind === "reply"
        ? "Your reply"
        : kind === "comment"
          ? "Your comment"
          : "Your message";
  const suggestions =
    body.trim().length >= 3
      ? kind === "feedback"
        ? suggestFeedback(posts, body)
        : kind === "message"
          ? suggestArticles(articles, body)
          : []
      : [];
  const canSend =
    !!onSubmit &&
    (!!body.trim() || !!files.length) &&
    !pending &&
    !preparing &&
    !offline;
  return (
    <form
      ref={form}
      className={`qb-composer qb-compose-${kind}${kind === "reply" ? " qb-reply-composer" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit?.();
      }}
    >
      {kind === "message" && (
        <div className="qb-conversation-intro">
          <Avatar {...(teamMember ?? { name: "Quills" })} />
          <h1>What can we help you with?</h1>
          <p id={`${fieldId}-hint`}>Ask a question or share what you need.</p>
        </div>
      )}
      <label
        className={kind === "reply" ? "qb-composer-label" : "qb-sr-only"}
        htmlFor={fieldId}
      >
        {label}
      </label>
      {kind === "reply" && (
        <p className="qb-composer-hint" id={`${fieldId}-hint`}>
          Continue the conversation with the team.
        </p>
      )}
      {articleContext && (
        <p className="qb-article-context">About: {articleContext}</p>
      )}
      <div className="qb-writing-area">
        <textarea
          id={fieldId}
          rows={kind === "message" ? 1 : 2}
          autoFocus={!compact}
          aria-describedby={
            `${kind === "message" || kind === "reply" ? `${fieldId}-hint` : ""}${error ? ` ${fieldId}-error` : ""}`.trim() ||
            undefined
          }
          placeholder={
            kind === "feedback"
              ? "What's on your mind?"
              : kind === "comment"
                ? "Add a comment…"
                : kind === "message"
                  ? "Message…"
                  : "Write a message…"
          }
          value={body}
          onChange={(event) => onChange(event.target.value)}
          readOnly={pending}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey) &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (canSend) onSubmit?.();
            }
          }}
        />
        {attachmentsEnabled && onFilesChange && (
          <AttachmentControls
            key={attachmentReset}
            files={files}
            onChange={onFilesChange}
            disabled={pending}
            camera={kind === "feedback"}
            onCapture={onCapture}
            onBusy={setPreparing}
            target={form}
          />
        )}
        <div className="qb-composer-actions">
          <span className="qb-send-status" aria-live="polite">
            {pending
              ? kind === "feedback"
                ? "Posting your feedback…"
                : "Sending your message…"
              : ""}
          </span>
          <button
            className={kind === "feedback" ? "qb-primary" : "qb-send-round"}
            disabled={!canSend}
            type="submit"
            aria-label={
              pending
                ? "Sending…"
                : kind === "feedback"
                  ? "Post"
                  : kind === "reply"
                    ? "Send reply"
                    : kind === "comment"
                      ? "Post comment"
                      : "Send"
            }
          >
            {kind === "feedback" ? (
              pending ? (
                "Sending…"
              ) : (
                "Post"
              )
            ) : (
              <Icon name="up" />
            )}
          </button>
        </div>
      </div>
      {!!suggestions.length && (
        <aside
          className="qb-suggestions"
          aria-label={
            kind === "feedback" ? "Similar requests" : "Suggested help"
          }
        >
          <h2>
            {kind === "feedback" ? "Similar requests" : "Suggested articles"}
          </h2>
          {suggestions.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() =>
                kind === "feedback"
                  ? onOpenPost?.(item.id)
                  : onOpenArticle?.(item.id)
              }
            >
              <Icon name={kind === "feedback" ? "feedback" : "help"} />
              {item.title}
              <Icon name="chevron" />
            </button>
          ))}
        </aside>
      )}
      {onBrowseHelp && kind === "message" && !!body.trim() && (
        <button
          type="button"
          className="qb-text-button qb-browse-help"
          onClick={onBrowseHelp}
        >
          Browse help without losing your draft <Icon name="arrow" />
        </button>
      )}
      {(!onSubmit || offline) && (
        <p className="qb-form-note">
          {offline
            ? "You’re offline. Your draft stays here until you reconnect."
            : "Sending is not available right now."}
        </p>
      )}
      {error && (
        <p className="qb-form-error" role="alert" id={`${fieldId}-error`}>
          {error}
        </p>
      )}
    </form>
  );
}
