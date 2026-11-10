# RFC 0005: Followed-request activity and article feedback

Status: **Proposed — backend not implemented**. Depends on the authenticated visitor adapter in RFC 0001, transactional writes/events in RFC 0002, and content visibility/follows in RFC 0003. The Storybook service is an in-memory mock; it is not an authorization boundary.

## Frontend contract

`WidgetView.activities` accepts newest-first `RequestActivity` records: `{id, postId, title, kind, summary, createdAt, unread}`. Kinds are `reply`, `status`, and `shipped`. Activity opens the exact request, preserves Back navigation, and has an explicit Mark as read action. Opening a request alone does not acknowledge an activity. `onReadActivity(id)` resolves after the adapter supplies the authoritative unread state; failure leaves the item unread and exposes retry. This internal screen leaves the SDK's five tabs, commands, and bridge unchanged.

`HelpArticle.helpful` is the current visitor's optional boolean response. `onArticleFeedback(articleId, helpful)` sets desired state, including changing Yes to No, and resolves only after authoritative props update. No callback means no feedback controls. Offline controls are disabled. Never show success or aggregate response counts based on an unconfirmed write.

Still need help opens a separate article-specific draft, retaining the ordinary message draft. The message callback receives `SubmissionOptions.articleId` alongside text, Files, and the idempotency key. An unchanged retry retains all of these values. The host remounts the keyed view on visitor changes. Do not infer authorization from an article title, URL, client-supplied visitor, or draft key.

## Proposed routes and storage

| Route | Contract |
| --- | --- |
| `GET /api/widget/activity?cursor=…` | Authorized newest-first page, opaque stable cursor, unread count, revision |
| `PUT /api/widget/activity/:id/read` | Idempotently mark this visitor's item read; return authoritative record/count/revision |
| `PUT /api/widget/help/:id/feedback` | `{helpful: boolean}`; set one response per instance/article/visitor; return visitor-safe article projection/revision |
| `POST /api/widget/conversations` | Extend RFC 0002 with optional validated `articleId`; store verified context atomically with first message |

Map these proposals to existing controllers, models, ID prefixes, permissions, and event infrastructure before adding routes/tables. Use Zod at API boundaries and update OpenAPI. Bound text, page size, cursor size, and mutation rate. Use 400 for malformed input, 404 for absent/inaccessible resources without revealing existence, 409 for idempotency payload conflicts, and 429 with Retry-After for limits.

Persist each activity recipient with unique `(instance, visitor, eventId)` and a read marker. Generate eligible recipients from current follows when a published reply or status transition commits. Exclude the reply author. A shipped transition generates one shipped event, not both shipped and generic status events. Repeated same-status writes and retried comments must not generate duplicates. Preserve historical activity on unfollow, but stop new deliveries and recheck follow/visibility before delayed delivery. Private/internal comments never create public activity. Recheck request and workspace visibility when reading both the feed and individual targets; permission loss must remove sensitive cached titles/excerpts.

Use the existing publishEvent/WebSocket path with transactional recovery for committed events. Redis is optional fan-out. Deduplicate by event ID and apply only newer revisions; reconnect resynchronizes the authoritative feed. Pagination must use stable server ordering, not client clocks. The current UI accepts a complete supplied list; implement continuation UI before exposing a truncated production feed. No email, push, desktop notifications, or automatic host-page prompts are implied.

Article responses use a unique `(instance, article, visitor)` record with desired boolean state. Authorize against the currently published article on every write. Retrying a Yes or No cannot increment a counter twice; serialize or derive aggregates from rows. Keep individual responses and internal analytics private. Do not create tracking device IDs for this feature. Anonymous visitors use the authenticated widget principal from RFC 0001.

Resolve conversation article context on the server within the same instance and visibility rules. Persist an article relation and, if needed for historical support context, a bounded server-derived title/version snapshot. Include the validated article ID in the canonical idempotency hash, alongside body and attachment identities. Reject a changed article under an already accepted key. An unpublished/deleted/foreign article must not create a conversation referencing inaccessible content. The support inbox must render the authorized context when the real backend is implemented.

## Acceptance gates

- PostgreSQL integration: duplicate/concurrent events and acknowledgments; no self-reply notification; correct status/shipped kinds; unfollow before queued delivery; visibility revocation; foreign instance/visitor/activity IDs; stable pagination and unread counts after restart.
- Article feedback: Yes → No → Yes, duplicate desired-state writes, concurrent writes, rejected/expired sessions, unpublished/deleted articles, rate limiting, private counts, and visitor isolation.
- Contextual conversations: verify stored article relation, altered-context idempotency conflict, lost response/retry creates one thread, deletion between open and send preserves a failed draft, and unauthorized article IDs create no data.
- Adapter/browser: late responses after A → B → anonymous; offline errors; read failure/retry; Back restores activity position; ordinary and article drafts remain separate; reconnect drops stale revisions. Test a real API/database and separately hosted iframe before claiming integration.
- Inspect migrations and rollback compatibility, validate OpenAPI, test a single self-hosted instance without Redis, and keep mock-only stories clearly labeled.
