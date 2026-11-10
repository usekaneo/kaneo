# Public feedback portal

**Status:** documentation-only placeholder. **Milestone:** [M1](https://github.com/PlaybookMediaLLC/kaneo/issues/7).

A branded public destination where customers of an independent founder's software can submit feature requests, report problems, vote, comment, and see public decisions and release updates. It should feel like the feedback portion of UserJot, but use original code, assets and copy.

## Responsibilities

- Each portal belongs to a product inside an authorized Kaneo workspace; product identity and public URLs must not leak other workspaces.
- Public requests, voting, discussion, attachment evidence, subscriptions and request status display.
- Roadmap and changelog views derived from explicitly published feedback/verified releases, not raw internal tasks.
- Clear moderation, spam/rate limits, user consent and accessible guest/customer experiences.

## Integration contract

Use the future `packages/feedback` domain and its dedicated public APIs. A customer must **not** be able to read Kaneo's internal project boards, runner sessions, privileged tasks, access tokens or unpublished feedback.

Do not recreate Kaneo's backlog or board engine here. No application framework or deployment decision has been made yet. The upstream `apps/web` application remains untouched by this placeholder.
