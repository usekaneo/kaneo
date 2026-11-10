# Delivery milestones

This is a dependency-ordered roadmap for a feedback-to-implementation product for **independent software founders**. No dates or automatic delivery commitments are implied. The GitHub links below are **milestone tracking issues**; they are **not** native GitHub Milestone records.

## Roadmap

| ID | Milestone | Tracker | Dependency | Exit condition |
| --- | --- | --- | --- | --- |
| M0 | Repository foundation and upstream boundaries | [#6](https://github.com/PlaybookMediaLLC/kaneo/issues/6) | None | Docs, directory ownership, license/brand rules and upstream policy approved |
| M1 | Feedback product parity: portal, boards, roadmap, changelog, widget, headless API/MCP, P0 Slack/AI analysis, optional conversations | [#7](https://github.com/PlaybookMediaLLC/kaneo/issues/7) | M0 | Customer can submit feedback, founder can analyze demand, and Slack intake passes security and E2E tests |
| M2 | Triage, decisions, and Kaneo task linkage | [#8](https://github.com/PlaybookMediaLLC/kaneo/issues/8) | M1 | Founder reviews feedback and links it to canonical Kaneo tasks without losing evidence |
| M3 | GitHub handoff and unmodified Orchestrator intake | [#9](https://github.com/PlaybookMediaLLC/kaneo/issues/9) | M2 | Founder approval creates one actionable GitHub issue; configured Orchestrator can discover it without source modifications |
| M4 | Feedback-aware MCP and API integrations | [#10](https://github.com/PlaybookMediaLLC/kaneo/issues/10) | M2 (M3 for end-to-end) | Claude Code and other authorized clients can read context and propose work without credential sharing |
| M5 | Verified releases and customer close-the-loop | [#11](https://github.com/PlaybookMediaLLC/kaneo/issues/11) | M3 | Deployment/release evidence supports changelog and requester notifications |
| M6 | Founder onboarding, brand, and launch readiness | [#12](https://github.com/PlaybookMediaLLC/kaneo/issues/12) | M1–M5 | Founder completes full workflow safely with documented setup and passing validation |
| M7 | Optional direct runner bridge and managed execution | [#13](https://github.com/PlaybookMediaLLC/kaneo/issues/13) | M3–M6 and demand | Only if needed: outbound-only runner, live session controls and/or bounded cloud execution |

## Sequencing

M0 starts as source-layout documentation and expands into the 11 foundation contracts tracked in #15–#25. M1 is now an expanded, prioritised UserJot functional-parity plan with 30 child issues (#26–#55), documented in [the parity matrix](../userjot-parity.md). It includes P0 core feedback **plus AI feedback analysis and Slack intake** (#46–#48), P1 optional AI auto-tagging, branding/custom domains, imports and email intake, and P2 conversation/knowledge/iOS breadth. Headless REST/MCP (#44–#45) remains P0. M1 and M2 can provide value without coding agents. M3 ships the lowest-maintenance automation path: **Kaneo-approved work -> GitHub issue -> official, locally installed Orchestrator**. M4 adds richer MCP/API access to feedback; it does not require a bespoke coding model. M5 only calls a feature *released* after deployment or explicit founder verification. M6 tests the complete founder journey. M7 is intentionally deferred and is **not** required for launch.

Keep the original Kaneo project-management engine upstream-owned. Do not begin by rebuilding its backlog, boards, tasks, roles, comments, or existing GitHub sync. Do not patch Orchestrator. Read [architecture](../architecture.md) and [upstream policy](../upstream-policy.md) before starting any milestone.

## Definition of done for future implementation PRs

Each feature PR must document its owner boundary and APIs, authorization and tenancy behavior, schema migrations if any, tests (unit/integration/browser as appropriate), migration/rollback considerations, upstream compatibility, and direct evidence for the customer-visible behavior. A passing test suite is necessary but not sufficient to claim a customer-facing release.

The parity matrix and child issues are planning artifacts only; they do not establish feature implementation.
