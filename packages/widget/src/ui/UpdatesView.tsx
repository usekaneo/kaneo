import { UpdateCard } from "./UpdateCard.js";
import { UpdateActions } from "./UpdateActions.js";
import { Icon } from "./Icon.js";
import type { UpdateEntry, WidgetViewProps } from "./types.js";

export function UpdatesView({
  entries,
  onOpen,
  onReact,
  onShare,
}: {
  entries: readonly UpdateEntry[];
  onOpen: (id: string) => void;
  onReact?: WidgetViewProps["onReactToUpdate"];
  onShare?: WidgetViewProps["onShareUpdate"];
}) {
  return (
    <div className="qb-list-view qb-updates">
      <h1>Updates</h1>
      {entries[0] ? (
        <>
          <UpdateCard
            entry={entries[0]}
            onOpen={() => onOpen(entries[0]!.id)}
          />
          <UpdateActions
            key={entries[0].id}
            entry={entries[0]}
            onReact={onReact}
            onShare={onShare}
          />
          {entries.length > 1 && (
            <>
              <h2 className="qb-section-label">Earlier</h2>
              {entries.slice(1).map((entry) => (
                <button
                  type="button"
                  className="qb-earlier"
                  key={entry.id}
                  onClick={() => onOpen(entry.id)}
                >
                  <strong>{entry.title}</strong>
                  <span>{entry.date}</span>
                </button>
              ))}
            </>
          )}
        </>
      ) : (
        <div className="qb-empty">
          <span className="qb-empty-icon">
            <Icon name="updates" />
          </span>
          <h2>No updates yet.</h2>
          <p>Check back soon for the latest news.</p>
        </div>
      )}
    </div>
  );
}
