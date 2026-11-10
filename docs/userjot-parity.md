# UserJot capability parity — M0/M1 evidence and issue map

**Research snapshot:** November 7, 2026. **Status:** planning only; **none** of these issue descriptions establishes implemented functionality.

## Scope and interpretation

The target is a founder-focused customer-feedback product built as Playbook-owned modules around the existing Kaneo fork. UserJot is a **functional benchmark** for feature requests, boards, roadmap, changelog, widget, Slack, headless APIs/MCP and AI agents. Its public help center also documents conversations, AI customer support, imports and Swift SDKs; the matrix retains those capabilities as P2 rather than silently omitting them.

The two major distinctions are deliberate: a **customer feedback board** is not a Kaneo engineering project/board, and **completed engineering work** is not a verified customer-facing release. The product must keep original feedback evidence, founder approval and customer notification rights across that lifecycle.

**P0** = required to demonstrate the core product, now including founder-invoked evidence-backed AI feedback analysis and Slack feedback intake; **P1** = extended parity worth developing after the core loop; **P2** = substantial support/mobile expansion. Complete UserJot functional parity cannot be claimed until all required P0/P1/P2 cases have been implemented and tested. Exact visual imitation, copying proprietary source, trademarks or brand assets is excluded.

## M0 — Architecture and compatibility contracts

| ID | Design work | Issue | Official reference |
|---|---|---|---|
| M0-01 | UserJot feature inventory and test matrix | [#15](https://github.com/PlaybookMediaLLC/kaneo/issues/15) | [Docs](https://feedback.userjot.com/help) |
| M0-02 | Reuse Kaneo auth, API, MCP, editor, Slack and task primitives | [#16](https://github.com/PlaybookMediaLLC/kaneo/issues/16) | [Docs](https://github.com/usekaneo/kaneo) |
| M0-03 | Product, board, request, vote, customer/company and release schema | [#17](https://github.com/PlaybookMediaLLC/kaneo/issues/17) | [Docs](https://feedback.userjot.com/help/articles/create-a-board) |
| M0-04 | Guest, signed identity, automatic login and access | [#18](https://github.com/PlaybookMediaLLC/kaneo/issues/18) | [Docs](https://feedback.userjot.com/help/articles/signed-identity) |
| M0-05 | Workflow state vs moderation vs visibility | [#19](https://github.com/PlaybookMediaLLC/kaneo/issues/19) | [Docs](https://feedback.userjot.com/help/articles/triage-requests) |
| M0-06 | Headless REST, MCP, token and idempotency contracts | [#20](https://github.com/PlaybookMediaLLC/kaneo/issues/20) | [Docs](https://userjot.com/headless) |
| M0-07 | Outbox, email, Slack and notification preferences | [#21](https://github.com/PlaybookMediaLLC/kaneo/issues/21) | [Docs](https://feedback.userjot.com/help/articles/notify-subscribers) |
| M0-08 | Widget/portal SDK, custom domain and CSP contracts | [#22](https://github.com/PlaybookMediaLLC/kaneo/issues/22) | [Docs](https://feedback.userjot.com/help/articles/widget-sdk-reference) |
| M0-09 | AI triage, evidence grounding, safety and provider budgets | [#23](https://github.com/PlaybookMediaLLC/kaneo/issues/23) | [Docs](https://feedback.userjot.com/help/articles/meet-juno) |
| M0-10 | Fixture, browser, API, security and CI verification plan | [#24](https://github.com/PlaybookMediaLLC/kaneo/issues/24) | [Docs](https://feedback.userjot.com/help) |
| M0-11 | Import/export source mapping and history preservation | [#25](https://github.com/PlaybookMediaLLC/kaneo/issues/25) | [Docs](https://feedback.userjot.com/help/articles/import-data) |

The M0 milestone parent is [#6](https://github.com/PlaybookMediaLLC/kaneo/issues/6). Each design issue must preserve upstream-owned Kaneo project management, authorization, migrations, REST/MCP and build structure. Orchestrator is an **optional, unmodified external** execution client; this phase does not fork it.

## M1 — Customer-visible capabilities and integrations

| ID | Priority | Feature and UserJot capability benchmark | Issue | Official reference |
|---|---|---|---|---|
| M1-01 | P0 | Feedback boards: CRUD, colors/order, public/private | [#26](https://github.com/PlaybookMediaLLC/kaneo/issues/26) | [Source](https://feedback.userjot.com/help/articles/create-a-board) |
| M1-02 | P0 | Public feedback site and request details | [#27](https://github.com/PlaybookMediaLLC/kaneo/issues/27) | [Source](https://feedback.userjot.com/help/articles/share-your-board) |
| M1-03 | P0 | Feature requests/bug reports, guest submission | [#28](https://github.com/PlaybookMediaLLC/kaneo/issues/28) | [Source](https://feedback.userjot.com/help/articles/guest-feedback) |
| M1-04 | P0 | Comments, replies and reactions | [#29](https://github.com/PlaybookMediaLLC/kaneo/issues/29) | [Source](https://feedback.userjot.com/help/articles/notify-subscribers) |
| M1-05 | P0 | Votes, follows, request subscribers | [#30](https://github.com/PlaybookMediaLLC/kaneo/issues/30) | [Source](https://feedback.userjot.com/help/articles/notify-subscribers) |
| M1-06 | P0 | Search, filters, tags, Top/Trending/Newest | [#31](https://github.com/PlaybookMediaLLC/kaneo/issues/31) | [Source](https://feedback.userjot.com/help/articles/how-trending-works) |
| M1-07 | P0 | Moderation, spam detection, hiding | [#32](https://github.com/PlaybookMediaLLC/kaneo/issues/32) | [Source](https://feedback.userjot.com/help/articles/moderate-content) |
| M1-08 | P0 | Similarity suggestions, merge/unmerge, vote provenance | [#33](https://github.com/PlaybookMediaLLC/kaneo/issues/33) | [Source](https://feedback.userjot.com/help/articles/merge-duplicates) |
| M1-09 | P1 | AI auto-tag suggestions | [#34](https://github.com/PlaybookMediaLLC/kaneo/issues/34) | [Source](https://feedback.userjot.com/help/articles/auto-tag-feedback) |
| M1-10 | P0 | Customer identity, SSO, company, signed JWT | [#35](https://github.com/PlaybookMediaLLC/kaneo/issues/35) | [Source](https://feedback.userjot.com/help/articles/signed-identity) |
| M1-11 | P0 | Founder triage actions, status transitions and stale flags | [#36](https://github.com/PlaybookMediaLLC/kaneo/issues/36) | [Source](https://feedback.userjot.com/help/articles/triage-requests) |
| M1-12 | P0 | Internal/public roadmap driven by feedback states | [#37](https://github.com/PlaybookMediaLLC/kaneo/issues/37) | [Source](https://feedback.userjot.com/help/articles/plan-work) |
| M1-13 | P0 | Changelog drafts, cover images, scheduling, linked requests | [#38](https://github.com/PlaybookMediaLLC/kaneo/issues/38) | [Source](https://feedback.userjot.com/help/articles/publish-updates) |
| M1-14 | P0 | Status emails, weekly digest, activity and preferences | [#39](https://github.com/PlaybookMediaLLC/kaneo/issues/39) | [Source](https://feedback.userjot.com/help/articles/notify-subscribers) |
| M1-15 | P1 | Original branding, verified custom domains and localization | [#40](https://github.com/PlaybookMediaLLC/kaneo/issues/40) | [Source](https://feedback.userjot.com/help/articles/custom-domain) |
| M1-16 | P0 | Embeddable widget loader, launcher, identity and SDK events | [#41](https://github.com/PlaybookMediaLLC/kaneo/issues/41) | [Source](https://feedback.userjot.com/help/articles/widget-sdk-reference) |
| M1-17 | P0 | Widget feedback, roadmap, updates, unread and embeds | [#42](https://github.com/PlaybookMediaLLC/kaneo/issues/42) | [Source](https://feedback.userjot.com/help/articles/widget-overview) |
| M1-18 | P0 | Screenshot capture, annotation and attachments | [#43](https://github.com/PlaybookMediaLLC/kaneo/issues/43) | [Source](https://feedback.userjot.com/updates/introducing-the-new-userjot-widget-beta) |
| M1-19 | P0 | Headless REST, API tokens, OpenAPI, idempotency | [#44](https://github.com/PlaybookMediaLLC/kaneo/issues/44) | [Source](https://userjot.com/headless) |
| M1-20 | P0 | Agent-ready MCP tools using existing Kaneo MCP | [#45](https://github.com/PlaybookMediaLLC/kaneo/issues/45) | [Source](https://feedback.userjot.com/help/articles/mcp-overview) |
| M1-21 | P0 | Grounded AI classification, prioritization and release drafts | [#46](https://github.com/PlaybookMediaLLC/kaneo/issues/46) | [Source](https://userjot.com/mcp) |
| M1-22 | P0 | Slack OAuth app, channel routing, event settings | [#47](https://github.com/PlaybookMediaLLC/kaneo/issues/47) | [Source](https://userjot.com/slack) |
| M1-23 | P0 | Slack message capture, slash/modal and event threads | [#48](https://github.com/PlaybookMediaLLC/kaneo/issues/48) | [Source](https://userjot.com/slack) |
| M1-24 | P1 | CSV, Canny, Nolt, ProductRoad migration with history | [#49](https://github.com/PlaybookMediaLLC/kaneo/issues/49) | [Source](https://feedback.userjot.com/help/articles/import-data) |
| M1-25 | P2 | Widget chat and shared support inbox with email | [#50](https://github.com/PlaybookMediaLLC/kaneo/issues/50) | [Source](https://feedback.userjot.com/help/articles/conversations-overview) |
| M1-26 | P2 | AI support agent, approved knowledge and human handoff | [#51](https://github.com/PlaybookMediaLLC/kaneo/issues/51) | [Source](https://feedback.userjot.com/help/articles/meet-juno) |
| M1-27 | P2 | Swift/iOS SDK parity | [#52](https://github.com/PlaybookMediaLLC/kaneo/issues/52) | [Source](https://feedback.userjot.com/help/articles/swift-sdk-overview) |
| M1-28 | P2 | Help center pages and indexed knowledge articles | [#53](https://github.com/PlaybookMediaLLC/kaneo/issues/53) | [Source](https://feedback.userjot.com/help) |
| M1-29 | P1 | Email-to-feedback intake and customer/company sync | [#54](https://github.com/PlaybookMediaLLC/kaneo/issues/54) | [Source](https://userjot.com/headless) |
| M1-30 | P0 | End-to-end parity, quality and launch gate | [#55](https://github.com/PlaybookMediaLLC/kaneo/issues/55) | [Source](https://feedback.userjot.com/help) |

The M1 milestone parent is [#7](https://github.com/PlaybookMediaLLC/kaneo/issues/7). **Priority distribution: P0 22 issues, P1 4 issues, P2 4 issues.** AI auto-tagging (#34) remains P1 and must not block P0 evidence-backed analysis (#46). Secure Slack connection (#47) is a necessary P0 prerequisite for Slack message-to-request intake (#48). See each child issue for implementation boundaries, dependencies, acceptance criteria and negative/security tests.

## Specific documented behaviors we must not simplify away

1. **Request workflow is not publication.** UserJot distinguishes Pending, Reviewing, Planned, In Progress, Completed and Closed from content moderation and visibility. Only eligible public statuses appear on the public roadmap. [Triage](https://feedback.userjot.com/help/articles/triage-requests), [Roadmap](https://feedback.userjot.com/help/articles/plan-work).
2. **Votes and duplicates preserve provenance.** One customer vote counts once on a canonical request, historical timestamps matter for Trending, and merging must be reversible. [Duplicate merges](https://feedback.userjot.com/help/articles/merge-duplicates), [Trending](https://feedback.userjot.com/help/articles/how-trending-works).
3. **The widget is a complete in-app client.** Feedback, search/vote/comments, roadmap, updates, notifications, optional messages, deep links, identity, custom launchers, events and inline embeds belong to the same SDK; screenshot annotations are part of the new widget experience. [Overview](https://feedback.userjot.com/help/articles/widget-overview), [SDK](https://feedback.userjot.com/help/articles/widget-sdk-reference), [Widget release](https://feedback.userjot.com/updates/introducing-the-new-userjot-widget-beta).
4. **Public roadmap and changelog are connected but independent.** Public roadmap is status-derived; changelog has drafts, scheduled publishing, authors, media and linked requests. Privacy gating applies to those linked requests. A merged GitHub PR must not be represented as a shipped feature until release verification. [Roadmap](https://feedback.userjot.com/help/articles/plan-work), [Changelog](https://feedback.userjot.com/help/articles/publish-updates).
5. **Subscribers have control.** Authors/voters/commenters/followers may receive status notifications, replies and digests, but permissions, moderation, preferences and duplicate events must be checked at send time. [Subscriber behavior](https://feedback.userjot.com/help/articles/notify-subscribers), [Preferences](https://feedback.userjot.com/help/articles/notification-preferences).
6. **Slack is P0 and needs round-trip context, not just alerts.** Capture from Slack message actions and slash/modal; draft from original words; preserve authorship; maintain one root message per request and thread subsequent events there. Existing Kaneo Slack code should be audited, not blindly copied or replaced. [Slack](https://userjot.com/slack).
7. **P0 AI feedback analysis and agents need secure interfaces.** AI recommendations must cite original requests and comments, preserve founder approval, enforce model budgets and never silently merge, publish or mutate requests. Headless agents need authenticated, stable tools. UserJot exposes workspace-scoped REST/OpenAPI, MCP, bearer tokens, delta queries and idempotent writes for unattended routines; external Claude Code login credentials should never be scraped or proxied. [Headless](https://userjot.com/headless), [MCP](https://userjot.com/mcp), [REST](https://feedback.userjot.com/help/articles/rest-api).
8. **AI support is a separate large feature.** UserJot Conversations/Juno use chat+email inbox, published knowledge, handoff to a human, and customer confirmation before acting on feedback. Do not conflate support AI with the coding-agent runtime. [Conversations](https://feedback.userjot.com/help/articles/conversations-overview), [Juno](https://feedback.userjot.com/help/articles/meet-juno), [Feedback consent](https://feedback.userjot.com/help/articles/juno-and-feedback-requests).
9. **Import isn't a bulk insert.** Existing votes, authors and timestamps need to remain traceable. [Import docs](https://feedback.userjot.com/help/articles/import-data).
10. **Self-service and mobile are in the documented product breadth.** Public help articles, data API and a Swift SDK have their own integration surfaces, tracked under M1 P2 rather than considered shipped in the web MVP. [Help index](https://feedback.userjot.com/help), [Swift](https://feedback.userjot.com/help/articles/swift-sdk-overview).

## Acceptance journeys

- **Customer:** founder enables board and widget, visitor files feature request, identifies themselves or posts as a guest, finds a similar request, votes, comments and follows; updates are delivered only with consent and access.
- **Founder:** founder reviews a pending request, approves and tags, merges duplicates, moves to Planned/In Progress, edits roadmap, drafts and schedules a changelog, verifies actual release and notifies the original customers.
- **Agent:** founder connects an authorized coding client over the existing Kaneo MCP/REST surfaces, reads feedback context, proposes next steps, creates *drafts* with idempotent operations and cannot delete/publish or reveal another tenant without explicit authorization.
- **Slack (P0):** approved Slack workspace creates a request from a source message, has one thread updated by subsequent events, and never leaks a hidden/private item to an unauthorized channel.
- **AI feedback analysis (P0):** founder invokes a summary of repeated complaints with evidence links and affected-request counts, reviews suggested priorities and implementation drafts, and can reject all suggestions; private feedback stays private and provider failure returns to manual triage.
- **Security:** forged identity, cross-tenant IDs, spam/unsafe media, unapproved moderation, duplicate delivery, prompt injection and stale signing keys are rejected or contained.
- **Optional support parity:** chat/email conversations link to feedback only with customer consent; grounded AI answers from published knowledge and hands off when confidence or policy requires.

## Verification and release rule

Every M1 issue remains open until its acceptance cases and authorization/error tests are in a reviewed PR. [M1-30](https://github.com/PlaybookMediaLLC/kaneo/issues/55) publishes the actual tested parity/gap report. Delivering P0 is **core-product readiness**, not proof of full UserJot parity. Do not claim closed-loop delivery from a mere task status or merged PR.

## Source inventory consulted

The [UserJot public help index](https://feedback.userjot.com/help) covers Workspace Setup, Import Data, Boards & Feedback, Roadmap & Changelog, Conversations, Juno, Widget, Swift SDK, API & MCP, and Billing/Account. Primary product references: [Homepage](https://userjot.com/), [Slack](https://userjot.com/slack), [Headless](https://userjot.com/headless), [MCP](https://userjot.com/mcp), [Docs](https://userjot.com/docs). Individual documented articles are linked above and in the child issues.

Some reference APIs and visual behaviors may change. Re-verify the actual published UserJot behavior when implementing each feature.
