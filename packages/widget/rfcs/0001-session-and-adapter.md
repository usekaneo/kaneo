# RFC 0001: Widget session, iframe application, and data adapter

Status: **Proposed**. Depends on existing SDK validation and lifecycle behavior. No production adapter is implemented by this RFC.

## Outcome

Serve a real `/widget` iframe that mounts `WidgetView`, translates the existing SDK bridge, and loads only the current instance's authorized visitor data. Switching A → B → anonymous must remove A's data and drafts immediately, including while requests are pending. Preserve `new-post`, board/title prefills, article/update deep links, launcher behavior, and public events.

## Ownership and trust

- The Hono API owns authentication, authorization, validation, and durable state. Route handlers use `createRoute`, Zod request/response schemas, thin controllers, and expected `HTTPException` responses. The iframe adapter validates every network and bridge boundary with shared inferred schemas; it never imports server implementation into the browser SDK.
- Derive instance and visitor context from a server-validated session. A posted user ID, name, or email is attribution, not authentication. It must not grant access to another user's conversations. Verify signed SSO tokens server-side, bind issuer/audience/instance, reject expiration and replay according to the existing auth contract, and keep signing keys off the browser.
- Prefer the existing cookie/session system. For embedded environments where third-party cookies are unavailable, perform a short-lived, single-use session exchange bound to instance and authorized host origin; return credentials only to the validated iframe context and hold them in memory. Do not put bearer credentials in iframe URLs, logs, analytics, localStorage, or public snapshots. Verify the precise exchange against the repository's auth implementation before adding an alternative.
- An anonymous visitor receives an unguessable server-issued session. A local mock visitor selector is not production identity. Anonymous → identified linking must prove ownership of both sessions; do not merge on email or host-supplied ID alone. Logout revokes the old session's access and establishes a new anonymous context. Document retention/deletion policy with the instance owner.
- Check exact parent origin and source for incoming bridge messages, strict message/payload schemas, navigation allowlists, and session generation. Use explicit target origins on outbound messages. Preserve existing HTTP(S)-only external navigation and noopener/noreferrer behavior. Retain the SDK's current command/event names; additive protocol changes require versioned compatibility tests.

## Proposed bootstrap contract

`GET /api/widget/bootstrap` uses the validated session and returns a validated snapshot:

```ts
type Bootstrap = {
  session: { instanceId: string; visitorSessionId: string; generation: string };
  revision: number;
  feedback: FeedbackPost[];
  articles: HelpArticle[];
  updates: UpdateEntry[];
  conversations: Conversation[];
  teamAvailability?: string;
};
```

Use the public UI shapes in `src/ui/types.ts`, bounded arrays/strings, safe nonnegative finite integer counts, valid status enums, and ISO timestamps. Reject `null`, wrong types, malformed IDs, and oversized payloads. Do not silently treat invalid data as a successful empty list. Serve `Cache-Control: private, no-store` for visitor snapshots. Authorization applies before filtering/serialization; never return other visitors' messages for client-side filtering.

Start with a bounded snapshot suitable for this UI. Define limits before rollout (proposed: 50 conversations, 100 feedback posts, 50 updates, 100 articles, 100 recent messages per conversation). Return explicit continuation metadata when more exists; add adapter pagination and visible older-message/list controls before shipping truncated data as complete. Do not silently omit a requested deep-link item: authorize and fetch it independently or return an unavailable state.

## Adapter lifecycle

1. Create one adapter per instance/visitor generation and mount `WidgetView` with `key={instanceId + ':' + visitorSessionId + ':' + generation}`. Supply empty private arrays immediately on identity change, then load. Keep the same view mounted inside an inert panel on close to preserve session drafts.
2. Own an `AbortController`, current generation, and highest applied revision. Abort fetches and unsubscribe on identity change/destroy. Ignore late responses even if abort races a completion. Merge authoritative mutation results only for the current session and acceptable revisions; old snapshots must not overwrite a newer mutation or event.
3. Set `loadState="loading"`, then `ready` only after schema validation. On failure set `error`; `onRetryLoad` retries the same authorized load. Preserve cached same-session content during reconnect. `navigator.onLine` is a hint, not proof of API reachability; transport outcomes determine online/offline/reconnecting.
4. Wire async action props to the API and update authoritative props before resolving. The UI ignores callback return values. Preserve `SubmissionOptions.idempotencyKey` on transport retries. Never submit an editable offline draft automatically. Do not restart pending UI writes across visitor changes.
5. Wire iframe readiness, open/close/identity/metadata/deep-link commands and existing SDK events through the current protocol. Only emit success events after durable success. Authenticate before returning unread counts, and update the SDK launcher only from current-session counts. Analytics permission and host consent remain independent of widget availability.

Drafts are intentionally memory-only, scoped to the keyed view. There is no localStorage persistence or silent recovery of a previous user's draft. On server expiry, remove private data before offering session recovery.

## Security and deployment gates

Apply existing workspace/instance permissions in API controllers, rate limits by authenticated session and instance, body-size limits, CSRF protection for cookie-authenticated writes, exact CORS allowlists, and an instance-controlled CSP `frame-ancestors` policy. Account for separately hosted API/web deployments via existing URL helpers. Use root `.env` for server configuration; do not bake secrets into Vite variables. Disable host analytics unless both instance and host permission allow it; DNT/GPC remain enforced in the SDK.

## Acceptance

- Real API tests: forged instance/visitor IDs, expired/invalid SSO, anonymous takeover, cross-tenant bootstrap/deep links, denied CORS/CSRF, malformed snapshots, limits, and private-cache headers.
- Adapter tests: deferred A response after B/anonymous, old revisions after new events, abort during retry, Strict Mode setup/cleanup, close/reopen draft retention, expiry clearing private state, recovery with cached same-session data.
- Browser tests: real cross-origin iframe, unrelated same-origin frame rejection, correct `event.source`, third-party-cookie restrictions, identity/deep-link queue before ready, keyboard/focus/inertness, narrow touch viewport, SDK teardown.
- Run generated OpenAPI update/check, API/database integration tests, widget package and build-entry tests, and the real iframe application's checks. No Storybook-only proof can satisfy these gates.

## Reader sizing and capture delegation

Connect `WidgetView.onExpandedChange` to the existing authenticated `quackback:expand` message. Help/update details request expansion; requests stay compact. The host shell uses 480 × 860 px on desktop, constrained to the viewport, and stays full-screen on mobile. Cleanup requests collapse. Do not add a second resize protocol or post to an unvalidated parent origin.

Only enable attachments when the adapter processes `SubmissionOptions.attachments`. Capture inside a cross-origin iframe requires an explicit host Permissions Policy and iframe `allow="display-capture"` delegation in browsers that support it. This checkout does not silently grant that permission. If unavailable, the UI offers file selection and a recoverable message. A host-supplied `onCaptureScreenshot(signal)` can implement approved host capture, but must return a File or null, respect cancellation, and stop all media tracks. Do not tunnel arbitrary host screenshots through an unvalidated new bridge message.
