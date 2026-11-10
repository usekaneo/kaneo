import { Icon } from "./Icon.js";
import { UpdateCard } from "./UpdateCard.js";
import type { UpdateEntry, WidgetTab, Conversation } from "./types.js";

export function HomeView({
  latest,
  navigate,
  compose,
  openUpdate,
  conversations,
  openConversation,
  teamAvailability,
}: {
  latest?: UpdateEntry;
  navigate: (tab: WidgetTab) => void;
  compose: (kind: "message" | "feedback") => void;
  openUpdate: (id: string) => void;
  conversations: readonly Conversation[];
  openConversation: (id: string) => void;
  teamAvailability?: string;
}) {
  const recent =
    conversations.find((item) => (item.unreadCount ?? 0) > 0) ??
    conversations[conversations.length - 1];
  return (
    <div className={`qb-home${recent ? " qb-home-returning" : ""}`}>
      <h1>
        Hi there <span className="qb-wave">👋</span>
        <span>How can we help?</span>
      </h1>
      {recent && (
        <button
          type="button"
          className="qb-resume"
          onClick={() => openConversation(recent.id)}
        >
          <Icon name="messages" />
          <span>
            <strong>
              {(recent.unreadCount ?? 0) > 0
                ? "You have a new reply"
                : "Continue your conversation"}
            </strong>
            <small>{recent.title}</small>
          </span>
          <Icon name="chevron" />
        </button>
      )}
      <div className="qb-contact-card">
        <span className="qb-avatar qb-team-avatar">
          <Icon name="messages" />
        </span>
        <h2>Send us a message</h2>
        <p>{teamAvailability ?? "Ask a question or share what you need."}</p>
        <button
          type="button"
          className="qb-message-prompt"
          onClick={() => compose("message")}
        >
          <span>Write a message…</span>
          <span className="qb-send-icon">
            <Icon name="arrow" />
          </span>
        </button>
      </div>
      <button
        type="button"
        className="qb-quick-link"
        onClick={() => navigate("help")}
      >
        <Icon name="support" weight="fill" />
        <span>Search for help</span>
        <Icon name="chevron" />
      </button>
      <button
        type="button"
        className="qb-quick-link"
        onClick={() => compose("feedback")}
      >
        <Icon name="inbox" weight="fill" />
        <span>Submit a request</span>
        <Icon name="chevron" />
      </button>
      {latest && (
        <section className="qb-latest">
          <div className="qb-section-label">
            <span>
              <Icon name="updates" />
              {latest.unread ? "New update" : "Latest update"}
            </span>
            <button type="button" onClick={() => navigate("updates")}>
              See all <Icon name="chevron" />
            </button>
          </div>
          <UpdateCard entry={latest} onOpen={() => openUpdate(latest.id)} />
        </section>
      )}
    </div>
  );
}
