# Widget definition of done

**Status: customer-journey sign-off pending.** The frontend and mock milestone is complete. This checklist defines the evidence required before calling the integrated widget production-ready; it does not claim the backend or release checks below have passed.

**Done means:** a visitor can use the widget inside a real host application, receive a real team response, and recover their accepted work after reload or reconnect. The API enforces access, records and images are durable, and the experience works in the supported deployment and browser configurations.

## Evidence rules

- Run against an actual host page, iframe application, API, test database, storage, and team interface. Use synthetic visitors and content; never production credentials or customer data.
- Storybook mocks, intercepted success responses, injected capture streams, and DOM simulations are useful frontend checks. They cannot satisfy durable storage, real delivery, OS permission, or physical-device gates.
- Record the exact revision and uncommitted patch, environment, date, tester, host/iframe/API origins, browser/OS/device versions, and commands. Attach redacted recordings, request/event IDs, and database/storage assertions where relevant. Do not include credentials, private image URLs, or session tokens.
- Mark a gate passed only when its expected result was observed. Missing infrastructure or unavailable devices mean **blocked/not checked**, not passed. Rerun affected gates after a fix and retain the result for the final candidate.

## 1. Establish the real integration

- [ ] Replace the mock for the tested journey with authenticated API actions and authoritative data refresh. Success UI and SDK events occur only after durable success. A callback firing or HTTP 200 alone is insufficient proof.
- [ ] Start with an anonymous visitor, identify visitor A, switch to B, then log out to anonymous. Server-issued identity controls access; a host-supplied ID or email alone grants no access to private conversations.
- [ ] Verify the existing script-tag queue, explicit-init precedence, vanilla API, and React adapter against the real iframe. Root/version imports remain safe without browser globals or React; ESM/CommonJS singleton and declaration checks pass.
- [ ] Open before readiness, follow a queued deep link, close/reopen, and perform rapid init/destroy/init. Invalid re-init options preserve the working instance. Owned requests, subscriptions, capture tracks, timers, and listeners end on destroy or identity change.
- [ ] Complete the core journey below in both bundled same-origin and separately hosted API/web deployments. Include a host page whose origin differs from the iframe and a browser configuration that restricts third-party cookies. Record the tested origins and session mechanism.

## 2. Complete the visitor-to-team journey

Use one traceable test visitor and record the created conversation, message, request, attachment, and event IDs. The team actor must use the actual team interface, not a Storybook simulation button or direct database edit.

| Step | Visitor/team action | Required visible and durable result |
| --- | --- | --- |
| J1 | Open the launcher and browse help, feedback, roadmap, and updates. | The correct instance's published content loads. Search, filters, Back, and deep links reach the intended item. Help/update readers expand and return to compact views correctly. |
| J2 | Open a help article, select Yes, change to No, and reload. | One visitor-specific helpfulness response remains No; retries do not inflate counts. Another visitor cannot read that private response. |
| J3 | Select Still need help and send a question. | A real conversation and first message are stored once. The team sees verified article context. An existing ordinary message draft remains separate. |
| J4 | Reply from the team interface while the widget is closed, then reopen it. | The visitor receives the real response and authoritative unread state. Opening/read acknowledgment preserves the opening unread divider; later arrivals are not incorrectly acknowledged by an older request. |
| J5 | Read older messages while another team reply arrives; then use Jump to latest and reply. | Reading position stays stable. Jump restores conversation focus; subsequent arrivals follow only near the bottom. Enter inserts a newline; Cmd/Ctrl+Enter sends outside IME composition. Confirm the reply in the team interface. |
| J6 | Submit feedback with an image, then open the resulting request. | Exactly one request and its authorized attachment records exist. The image loads from real storage after a full reload. The internal viewer supports navigation, zoom, Escape, and focus return. |
| J7 | Vote/unvote, follow/unfollow/refollow, add a comment and nested reply, and vote/unvote a comment. | Authoritative counts and visitor flags remain correct after reload. A nested reply belongs to the intended request and parent. |
| J8 | As a different team actor, publish a reply, change the followed request's status, and mark it shipped. | The follower receives the appropriate activity once and can open the exact request. A non-follower receives none; unfollow stops new delivery. Internal-only comments never appear. |
| J9 | Mark activity read, open a published update and its linked request, and change a reaction. | Read state and reactions persist without duplicate counts. Another visitor's read state remains unchanged. The linked request is still authorized. |
| J10 | Reload both interfaces, disconnect/reconnect the widget, and restart the test API. | Accepted messages, requests, comments, votes, follows, read markers, helpfulness, and images remain correct. Reconnect restores missed changes without duplicates or stale overwrites. |

- [ ] J1–J10 pass with browser evidence and durable-state assertions. Record latency or ordering failures instead of masking them with arbitrary sleeps or manual refreshes.
- [ ] Draft ownership matches the current contract: unsent text/files survive navigation and close/reopen within the same mounted visitor session; identity change/destroy clears them. Draft survival across page reload is not required. Accepted submissions must survive reload.

## 3. Prove recovery and isolation

- [ ] Lose a real response after the server commits, then retry unchanged text, images, and article context with the same key. Verify one durable result and one visible activity effect per eligible recipient, even if transport events repeat. Reusing that key with changed content or context returns a conflict.
- [ ] Exercise failure before commit, timeout, offline editing, double submit, expired session, upload failure, and reconnect. Preserve recoverable drafts; never silently send an offline draft or claim an unconfirmed success. Identity changes prevent late responses from restoring old private data.
- [ ] Deliver duplicate/out-of-order events and reconnect after a gap. Apply current authoritative revisions only. A read acknowledgment for M1 cannot mark a later M2 read.
- [ ] Use visitor A and B in two instances/workspaces. Attempt foreign conversation, request, comment-parent, activity, article, and attachment IDs through API requests and deep links. The server denies access without leaking private content or existence beyond its documented error contract.
- [ ] Revoke access or expire the session while a view/request is open. Clear private data and stop unauthorized subscriptions. Unpublished, deleted, or inaccessible content has a recoverable unavailable state.
- [ ] Reject iframe messages from an unexpected origin, a sibling window at the expected origin, or an obsolete iframe. Reject malformed messages/configuration. External navigation retains HTTP(S)-only checks and noopener/noreferrer protection.
- [ ] Verify DNT/GPC, absent consent, consent withdrawal, and re-init in browser storage/network inspection. No tracking device ID is created, stored, or sent without both instance and host permission; withdrawal persists. Analytics failures and retained History API wrappers do not break host navigation.

## 4. Prove image handling with real storage

- [ ] Select, paste, and drop supported images through actual OS/browser input. Enforce four images and 5 MiB per image; reject malformed, oversized, unsupported, and deceptive files at the API as well as the UI. Validate decoded format/dimensions and strip metadata on the server.
- [ ] Accept and cancel the real capture chooser where supported. Test denied/unsupported capture and cross-origin permission restrictions; file selection remains available. Closing, navigation, or destruction stops all capture tracks, including late chooser completion.
- [ ] Highlight/redact, undo, cancel, remove, and retry an attachment. Verify that only the accepted edited bytes are stored; redacted information and original metadata are not retained as a hidden companion.
- [ ] Reject foreign, expired, or unready attachment references. Private images require current authorization or scoped URLs. Renew an expired URL while the viewer is open and verify recovery. Failed/abandoned uploads are cleaned without exposing orphaned objects.

## 5. Finish browser and accessibility verification

Record actual versions and device models. Emulated viewport/touch checks supplement physical-device checks; they do not replace them.

| Environment | Required checks |
| --- | --- |
| Desktop Chromium and Firefox | Core journey; keyboard-only operation; clipboard/drop; iframe/session restrictions; focus return; host navigation; real capture chooser where supported. |
| Physical iPhone, Safari | Core journey; software keyboard; composer visibility; safe areas; scroll/zoom; touch targets; image selection; clipboard images where available; unsupported capture fallback. |
| Physical Android device, Chrome | Core journey; software keyboard; rotation; touch scrolling; image selection/paste; connection loss/recovery; capture support or fallback. |
| At least one supported screen-reader/browser pairing | Named controls, reading order, loading/error announcements, unread markers, dialog focus containment, focus return, and an inert closed panel. Record the pairing. |

- [ ] Verify light/dark themes, reduced motion, narrow/short viewports, long content, and browser text zoom without clipped controls or unintended horizontal overflow.
- [ ] Verify multiple images, failure/renewal, Escape closing only the active dialog, and keyboard panning while zoomed. Jump to latest keeps focus in the conversation and incoming messages do not steal composer focus.

## 6. Verify the final candidate and sign off

- [ ] Run the package checks below using a supported runtime; record commands, versions, and results. If a fallback is needed, record the original environment failure and exact fallback.

```sh
pnpm --dir packages/widget test
pnpm --dir packages/widget typecheck
pnpm --dir packages/widget build
pnpm --dir packages/widget storybook:build
pnpm exec vp check packages/widget
pnpm exec vp test list packages/widget --filesOnly
```

- [ ] Run affected API/database, iframe application, team UI, and consumer checks. Verify migrations against existing installations, generated OpenAPI, and one self-hosted instance without Redis. Use the RFC acceptance gates for implementation details.
- [ ] Record the normal CI run for the final candidate and confirm widget tests executed. A local package pass or test-discovery listing alone is not CI coverage. Record raw/gzip browser bundle sizes and investigate unexpected growth or React entering the vanilla bundle.
- [ ] Run the feature-flow review team for the implementation, resolve confirmed blocking findings, and rerun affected checks. Link the verdict and unresolved nonblocking issues with owners.
- [ ] Attach a final journey recording and evidence table. Every required gate is passed; any omitted feature has an explicit scope decision and is disabled in the release. A blocked security, data-integrity, or core-journey gate cannot be waived as a passing check.

| Sign-off field | Required value |
| --- | --- |
| Candidate | Revision plus exact uncommitted patch/artifact identity, if applicable |
| Environment | Test deployment, origins, database/storage configuration, browser/device matrix |
| Evidence | J1–J10 recording, automated/CI results, durable-state assertions, failure/isolation results |
| Ownership | Implementation owner, verification owner, reviewer, date |
| Decision | Ready for release approval, or not ready with named blockers |

Passing this definition of done does not authorize a commit, deployment, publication, or release. Those actions require the repository owner's instruction.

## Implementation references

- [RFC 0001 — Session, iframe application, and data adapter](0001-session-and-adapter.md)
- [RFC 0002 — Conversations and reliable delivery](0002-conversations-and-delivery.md)
- [RFC 0003 — Feedback, updates, and help content](0003-feedback-and-content.md)
- [RFC 0004 — Images, capture, and storage](0004-images-and-capture.md)
- [RFC 0005 — Activity, article feedback, and contextual conversations](0005-activity-and-article-feedback.md)
