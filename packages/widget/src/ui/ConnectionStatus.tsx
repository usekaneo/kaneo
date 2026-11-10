import { useAction } from "./useAction.js";
import type { WidgetViewProps } from "./types.js";

export function ConnectionStatus({
  loadState,
  connection,
  onRetry,
}: {
  loadState: WidgetViewProps["loadState"];
  connection: WidgetViewProps["connection"];
  onRetry?: () => Promise<unknown>;
}) {
  const action = useAction();
  if (connection === "online" && loadState === "ready") return null;
  return (
    <div className="qb-connection" role="status">
      <p>
        {connection === "offline"
          ? "You’re offline. You can keep reading and writing a draft."
          : connection === "reconnecting"
            ? "Reconnecting… Your work stays here."
            : loadState === "loading"
              ? "Loading your conversations, help, and updates…"
              : "Could not load the latest content."}
      </p>
      {loadState === "error" && connection === "online" && onRetry && (
        <button
          type="button"
          className="qb-text-button"
          disabled={action.pending}
          onClick={() => void action.run(onRetry)}
        >
          {action.pending ? "Retrying…" : "Retry loading"}
        </button>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </div>
  );
}
