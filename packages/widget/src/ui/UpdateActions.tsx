import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.js";
import type { UpdateEntry, WidgetViewProps } from "./types.js";

export function UpdateActions({
  entry,
  onReact,
  onShare,
}: {
  entry: UpdateEntry;
  onReact?: WidgetViewProps["onReactToUpdate"];
  onShare?: WidgetViewProps["onShareUpdate"];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function perform(action: () => Promise<unknown>, sharing = false) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setShared(false);
    try {
      await action();
      if (active.current && sharing) setShared(true);
    } catch {
      if (active.current) setError("That action failed. Please try again.");
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  if (!entry.reactions?.length && !onShare) return null;
  return (
    <>
      <div className="qb-update-actions" aria-label="Update reactions">
        {entry.reactions?.map((reaction) => (
          <button
            type="button"
            key={reaction.emoji}
            aria-label={`React ${reaction.emoji}`}
            aria-pressed={reaction.reacted ?? false}
            disabled={!onReact || pending}
            onClick={() => {
              if (onReact)
                void perform(() => onReact(entry.id, reaction.emoji));
            }}
          >
            <span>{reaction.emoji}</span>
            {reaction.count}
          </button>
        ))}
        <button
          type="button"
          className="qb-share"
          aria-label="Share update"
          title={onShare ? "Share update" : "Sharing is unavailable"}
          disabled={!onShare || pending}
          onClick={() => {
            if (onShare) void perform(() => onShare(entry), true);
          }}
        >
          <Icon name="link" />
        </button>
      </div>
      {error && (
        <p className="qb-action-status" role="alert">
          {error}
        </p>
      )}
      {shared && (
        <p className="qb-action-status" role="status">
          Update shared.
        </p>
      )}
    </>
  );
}
