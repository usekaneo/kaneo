import { Icon } from "./Icon.js";
import type { Conversation } from "./types.js";

export function MessagesView({
  conversations,
  onOpen,
  onCompose,
}: {
  conversations: readonly Conversation[];
  onOpen: (id: string) => void;
  onCompose: () => void;
}) {
  return (
    <div className="qb-list-view">
      <h1>Messages</h1>
      {conversations.length ? (
        conversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            className="qb-conversation"
            onClick={() => onOpen(conversation.id)}
          >
            <span className="qb-avatar">
              <Icon name="messages" />
            </span>
            <span>
              <strong>{conversation.title}</strong>
              <small>
                {conversation.messages[conversation.messages.length - 1]?.body}
              </small>
            </span>
            {(conversation.unreadCount ?? 0) > 0 && (
              <span
                className="qb-unread-count"
                aria-label={`${conversation.unreadCount} unread replies`}
              >
                {conversation.unreadCount}
              </span>
            )}
            <Icon name="chevron" />
          </button>
        ))
      ) : (
        <>
          <div className="qb-message-illustration" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div key={row}>
                <i />
                <span>
                  <i />
                  <i />
                </span>
              </div>
            ))}
          </div>
          <div className="qb-message-empty">
            <h2>No conversations yet</h2>
            <p>
              Send us a message and we’ll be happy to help.
              <br />
              Your conversations will appear here.
            </p>
          </div>
        </>
      )}
      <div className="qb-floating-action">
        <button type="button" className="qb-primary" onClick={onCompose}>
          <Icon name="pen" />
          New conversation
        </button>
      </div>
    </div>
  );
}
