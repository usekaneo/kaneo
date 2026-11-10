# RFC 0003: Feedback, updates, help, and contextual home

Status: **Proposed**. Depends on [RFC 0001](0001-session-and-adapter.md) and the reliable-write pattern in [RFC 0002](0002-conversations-and-delivery.md).

## Feedback actions

Use existing feedback/board models where available. Scope every read and write to the authorized instance, board visibility, and visitor. Never trust a hidden control or a host-supplied board ID as permission.

| Proposed route | Input and semantics |
| --- | --- |
| `POST /api/widget/feedback` | `{ body, boardId? }` plus `Idempotency-Key`; use the transactional receipt contract from RFC 0002 |
| `PUT /api/widget/feedback/:id/vote` | `{ voted: boolean }`; set desired state, never a blind toggle |
| `PUT /api/widget/feedback/:id/follow` | `{ following: boolean }`; set desired state, including unfollow |
| `GET /api/widget/feedback` | Bounded cursor/query/status/sort/board filters; authoritative counts and this visitor's flags |

Enforce a unique row per `(instance, feedback item, voter principal)` and the equivalent for follows. Use transactions or aggregate queries so retries/concurrency cannot inflate votes or make counts negative. An idempotent delete handles unvote/unfollow. Return the final item and revision, then let the adapter update UI props before resolving its callback. Do not accept client-supplied vote totals.

Map existing statuses explicitly to the public `open | planned | in_progress | shipped` vocabulary; do not rename stored statuses as incidental cleanup. Status changes are team-authorized actions. Validate nonnegative finite integer counts and public text limits; return no internal notes, email addresses, or unauthorized author details. The current UI filters by status and sorts supplied order, votes, or title. Any server pagination must preserve those semantics and expose continuation controls before replacing complete local lists.

## Discussions, roadmap, and linked requests

Add authorized `POST /api/widget/feedback/:id/comments` with `{body, parentId?}` and an idempotency key. Resolve the parent within the same instance, visible request, and non-deleted thread; reject foreign parents, cycles, and excessive depth. Plain text only. Limit body length, requests per visitor, total returned comments, and nesting. Use the same transactional receipt rules as feedback; scope keys to the visitor, request, and parent. Return authoritative comments through `FeedbackPost.comments` before resolving `onCommentFeedback`. Preserve stable IDs and oldest-first discussion order. The UI caps visual indentation after two levels; it does not impose server depth/size limits.

`PUT /api/widget/feedback/:id/comments/:commentId/vote` accepts `{voted}`. Uniqueness is per authorized visitor/comment. Never expose internal-only replies; use explicit publish/moderate/delete permissions and rate limits. Deletion preserves an authorized tombstone or reparents visible children according to an explicit policy. Team badges and public avatar URLs come from authorized server profiles, not visitor input. Add comment create/vote events and reconnect resync through the existing event path. No email is sent without notification consent.

The Roadmap projection groups `in_progress`, `planned`, and `shipped`, preserving server order. The UI initially shows three per group and retains Show more through detail navigation. Supply bounded complete groups for the current local renderer; a paginated backend needs explicit group cursors and continuation controls, not silently truncated arrays. Similar-request suggestions rank supplied public requests; future server search must apply the same visibility filters.

Updates may supply `relatedPostIds` and `requesterCount`. Return only visible linked requests and an authorized aggregate interest count. Do not infer that count from the number of loaded avatars, and do not leak identities from private boards. Help may supply a public HTTP(S) `url`, `author`, and `updatedAt`; dates and verified badges must reflect real records.

Acceptance additions: foreign/deleted comment parent, oversized/deep/cyclic thread rejection, concurrent desired-state comment votes, lost-response reply deduplication, moderation visibility, request → reply → Back draft continuity, roadmap Show more → request → Back, and update → linked request → Back scroll restoration. Include keyboard and mobile tests.

## Follows and updates

Following a request records interest; it is not consent to arbitrary marketing. Define whether updates appear in the widget, email, or both before enabling outbound delivery. Use existing notification preferences, unsubscribe paths, authorization, and delivery infrastructure. Do not send email from the Storybook mock or infer consent from an anonymous click. Unfollowing prevents future follow notifications; specify how already-queued sends recheck consent.

Store update read markers per visitor and authorized published update. Proposed `PUT /api/widget/updates/:id/read` is idempotent and returns authoritative unread counts/revision. Read state must not leak between identities. Only published, currently visible updates appear in Home and Updates. Reactions should use unique visitor/update/emoji records with bounded supported emoji; translate the existing `onReactToUpdate` toggle callback into desired state in the adapter to make transport retries safe. Sharing must use a validated public HTTP(S) URL and existing external-link protections, never an unpublished or private document URL.

Publish status/update changes through the existing event path, with optional Redis fan-out and authorized invalidation. Deduplicate notification delivery by durable event and recipient identifiers. Re-fetch on reconnect; do not increment unread or vote counts blindly from repeated events.

## Help content and search

Serve only published articles visible to this instance/visitor. The UI supports escaped paragraph, heading, list, and code blocks. Validate a discriminated block schema with bounded text, item counts, and total content size. Do not accept or render arbitrary HTML, executable Markdown extensions, unsanitized embeds, or `javascript:` links. Inline article images, rich links, and richer blocks require a separate explicit schema and rendering/security review. User attachments use RFC 0004.

`HelpArticle.body` remains the plain-text fallback. When `blocks` is nonempty it is the displayed/searchable content; an empty array falls back to `body`. Derive the server's search projection from those blocks so an indexed result matches what opens. The current bounded local search requires every query term and ranks title above category above body. Composer suggestions match meaningful words and are only a convenience; they never block submission. Before moving to server search, preserve category filters, stable ordering, safe literal highlighting, and draft/Back continuity. Rate-limit, cap query length, parameterize database queries, and start with PostgreSQL facilities; no new search service is needed for this scope.

For deep links, fetch the requested article independently of the initial page and apply the same visibility rules. Related articles currently share a category; use only authorized published candidates. If an article is removed between list and open, show unavailable and preserve the user's draft/previous list state.

## Contextual home and availability

Home selects a supplied unread conversation first, otherwise the most recent supplied conversation, and a supplied unread update first. The server/adapter must order conversations oldest-to-newest and updates newest-to-oldest to match the current fallback selection. Prefer an explicit `lastActivityAt` model and sorted adapter projection when implementing real persistence. Do not mix tenant/visitor context in caches.

Only supply `teamAvailability` from a configured schedule or an explicitly defined, measured response-time calculation. Omit it if unknown or stale. Do not manufacture online status or a response promise. Return visitor-safe text; keep team identities, schedules marked private, and internal staffing data out of the public snapshot.

## Acceptance and rollout

- PostgreSQL tests: simultaneous vote/unvote, duplicate desired-state writes, follow/unfollow, foreign/private board IDs, count accuracy, idempotent feedback submit, per-visitor update read markers, published/private article/update boundaries.
- Notification tests: duplicate events, unsubscribe before queued delivery, permission loss, reconnect resync, instance isolation. Use local test delivery sinks, never production recipients.
- Content tests: malformed/oversized blocks, literal script strings, unexpected enums, safe search metacharacters, inaccessible deep links, category/status/sort pagination, English stop-word limitations and future localization needs.
- Browser tests: search → article → Back preserves query/category/scroll/draft; vote/unvote and follow/unfollow update counts only after confirmation; offline writes are disabled; removed items and failed actions remain recoverable; Home and launcher counts reflect the same authoritative state.
- Inspect migrations and existing status mappings, generate/check OpenAPI, run affected API/web/widget tests, and verify one self-hosted instance without Redis. Keep the Storybook mock for deterministic failure scenarios, but do not count it as live backend or notification-delivery proof.
