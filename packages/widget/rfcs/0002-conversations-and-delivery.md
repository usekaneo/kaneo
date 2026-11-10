# RFC 0002: Conversations and reliable delivery

Status: **Proposed**. Depends on [RFC 0001](0001-session-and-adapter.md). The mock demonstrates the semantics; it does not persist messages or deliver them to a team.

## Outcome and API

Visitors can start a conversation, reply, reopen it later, see confirmed timestamps, and acknowledge only the messages they actually opened. A lost HTTP response followed by a retry must not create a second message. Visitor A cannot read, reply to, subscribe to, or acknowledge B's thread.

Proposed authenticated routes:

| Route | Input | Result |
| --- | --- | --- |
| `POST /api/widget/conversations` | `{ body }`, `Idempotency-Key` | Created conversation and first message, authoritative revision |
| `POST /api/widget/conversations/:id/messages` | `{ body }`, `Idempotency-Key` | Created message and updated conversation/unread state, revision |
| `GET /api/widget/conversations/:id` | Optional opaque cursor | Authorized thread with stable message ordering and continuation metadata |
| `PUT /api/widget/conversations/:id/read` | `{ throughMessageId }` | Current read watermark/unread count and revision |

Use shared Zod validation: trimmed nonempty plain text with an explicit maximum (proposed 10,000 characters), bounded opaque idempotency key (the UI generates 32 lowercase hexadecimal characters from 128 random bits), valid registered entity IDs, and bounded page size. Enforce the same body limit in the iframe composer before enabling the real endpoint. Existing UI callbacks always receive trimmed text and a key; legacy one-argument callback implementations remain valid but must adopt the key to provide safe transport retries.

Use `400` for malformed input, `401` for an invalid session, `404` for nonexistent or inaccessible resources where that avoids existence leaks, `409` for a key/payload conflict, `413` for excess size, `429` with `Retry-After` for throttling, and `503` for temporary unavailability. Never render raw server exception text. Preserve editable drafts after recoverable errors; require reauthentication after expiry.

## Persistence and idempotency

Reuse existing conversation/message models if they satisfy these constraints; otherwise add migrations under the API database path. Every conversation belongs to an instance and an authenticated visitor principal. Every message belongs to that conversation, has a server-generated ID, sender principal/role, server timestamp, and stable per-conversation ordering. Index instance/visitor/conversation lookups. `fromVisitor` is derived from authenticated ownership, never accepted as an authority from the body.

Store an idempotency receipt with a unique key over `(instance, visitor principal, operation scope, idempotency key)`. Scope distinguishes new conversation, new feedback, and reply-to-specific-conversation. Store a hash of the validated canonical payload and the durable result identifiers. In one database transaction, authorize, claim the receipt, write the message/conversation, record the result, and record the outbound event. A concurrent duplicate returns the original result; the same key with different content returns `409`. Roll back the receipt when the write rolls back.

The receipt must survive a process restart and a lost response. Define an expiry policy and expose the accepted retry window; proposed minimum is seven days. After that window, do not silently replay a previously accepted stale key as a new write: retain a tombstone or return an explicit expired-key error. The current memory-only frontend never auto-retries after reload, but the server still enforces its contract for other clients.

The UI reuses a key for unchanged trimmed text after failure; edited content gets a new key. It locks each pending draft across view changes. This protects the interaction, but exactly-once effects require the transaction above. If the visitor edits a draft after an ambiguous outcome, treat the edit as a new intentional submission and make recovery messaging clear.

## Unread correctness

Store a monotonic read watermark per authorized participant and conversation. Validate `throughMessageId` belongs to that thread; compare stable server order, not client time. Advance with `max(current, requested)` transactionally. Count only team messages after the watermark. A late acknowledgment must not mark a newer team reply read. Read/unread state is per visitor; changing user must never reuse another visitor's watermark.

Opening an unread thread invokes `onReadConversation` through the newest displayed message. Failed acknowledgment leaves the count unchanged and exposes retry. New arrivals while the thread is open remain unread until acknowledged; do not claim read merely because the iframe is loaded or hidden. The current UI shows Sent only for confirmed visitor messages, not delivered/read receipts.

The frontend retains the opening unread boundary even after that acknowledgment updates the count. It opens at the first unread team message (or the bottom when none), follows new messages only within 80 px of the bottom, and otherwise preserves reading position with Jump to latest. Enter inserts a newline; Command/Control+Enter submits outside IME composition. These controls add no server delivery/read guarantees. Article-origin conversation context is specified in RFC 0005.

## Realtime, reconnect, and privacy

Use the repository's `publishEvent()` path after the transaction and deliver through existing WebSocket infrastructure. Use a transactional outbox if existing event publishing cannot guarantee recovery after commit-before-publish failure. A single instance works without Redis; Redis only fans out between API instances. Do not add a mandatory managed broker.

Authorize subscriptions server-side, recheck/revoke on session or permission change, and bind events to instance, visitor, entity ID, event ID, and monotonic revision. Prefer small invalidation events followed by authorized fetches over broadcasting private message bodies. The adapter deduplicates events, ignores old revisions, and resynchronizes on reconnect/gaps. Bound reconnect backoff and pause when destroyed. Neither realtime errors nor analytics failures may break host navigation or the widget shell.

## Acceptance and rollout

- Database integration: simultaneous same-key requests, different-payload conflict, crash/lost response after commit, restart and retry, receipt rollback/expiry, foreign conversation and watermark rejection, stable pagination.
- Race tests: read M1 while M2 arrives, delayed M1 read after M2 read, duplicate/out-of-order events, reconnect after missed events, session revocation, A response after B initialization.
- End-to-end: create → persisted reply → close/reopen → team response → unread → read acknowledgment; server fail/retry, network interruption, anonymous/identified separation. Assert durable row counts and visible UI, not only HTTP status.
- Inspect migration SQL and indexes, backfill ownership/read state without exposing old data, use real local PostgreSQL, and update OpenAPI. Roll out behind instance capability/config so old iframe/SDK pairs still work. Keep existing data/protocol intact and test rollback to the previous UI with the new additive tables.
