import { useState } from "react";
import {
  useQuackback,
  useQuackbackEvent,
  useQuackbackInit,
} from "../src/react/index.js";

export interface WidgetPlaygroundProps {
  placement: "left" | "right";
  launcher: boolean;
  initializeDelay: number;
  shouldInitialize: boolean;
}

export function WidgetPlayground(options: WidgetPlaygroundProps) {
  const sdk = useQuackback();
  const [identity, setIdentity] = useState<"anonymous" | "ada" | "grace">(
    "anonymous",
  );
  const [ready, setReady] = useState(false);
  const [confirmedUser, setConfirmedUser] = useState("Waiting for iframe");
  const [lastEvent, setLastEvent] = useState("None");

  useQuackbackEvent("ready", () => setReady(true));
  useQuackbackEvent("identify", ({ user, success }) => {
    setConfirmedUser(
      success ? (user?.name ?? "Anonymous") : "Identification failed",
    );
  });
  useQuackbackEvent("open", (payload) =>
    setLastEvent(`open: ${JSON.stringify(payload)}`),
  );
  useQuackbackEvent("close", () => setLastEvent("close"));
  useQuackbackEvent("unread", ({ count }) => setLastEvent(`unread: ${count}`));
  useQuackbackInit({
    ...options,
    instanceUrl: new URL("./fixtures", window.location.href).href,
    tracking: false,
    identity:
      identity === "anonymous"
        ? undefined
        : {
            id: identity,
            email: `${identity}@example.com`,
            name: identity === "ada" ? "Ada Lovelace" : "Grace Hopper",
          },
  });

  return (
    <main className="widget-story">
      <h1>Widget SDK playground</h1>
      <p>
        The real launcher, panel, and React hooks use a local demo iframe. No
        backend or analytics is required.
      </p>
      <dl aria-live="polite">
        <dt>Iframe</dt>
        <dd>
          {!options.shouldInitialize ? "Disabled" : ready ? "Ready" : "Waiting"}
        </dd>
        <dt>Confirmed user</dt>
        <dd>{confirmedUser}</dd>
        <dt>Last event</dt>
        <dd>{lastEvent}</dd>
      </dl>
      <div className="widget-story-actions">
        <button type="button" onClick={() => sdk.open()}>
          Open widget
        </button>
        <button
          type="button"
          onClick={() => sdk.open({ articleId: "article_demo" })}
        >
          Open demo article
        </button>
        <button type="button" onClick={() => sdk.close()}>
          Close widget
        </button>
      </div>
      <fieldset>
        <legend>Host identity</legend>
        {(["anonymous", "ada", "grace"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="identity"
              value={value}
              checked={identity === value}
              onChange={() => setIdentity(value)}
            />
            {value === "anonymous"
              ? "Anonymous"
              : value === "ada"
                ? "Ada"
                : "Grace"}
          </label>
        ))}
      </fieldset>
      <p>
        Controls restart this playground with the chosen settings. Switch
        identity here to exercise identification without re-initializing.
      </p>
    </main>
  );
}
