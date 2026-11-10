# Execution contracts

**Status:** documentation-only placeholder. **Milestones:** [M3](https://github.com/PlaybookMediaLLC/kaneo/issues/9), optional [M7](https://github.com/PlaybookMediaLLC/kaneo/issues/13).

Provider-independent contracts for the relationship between **approved Kaneo work**, GitHub artifacts, and optional coding-agent sessions. These must not introduce a second product-management task model.

## Concepts to define when needed

- Stable correlation IDs linking feedback requests, Kaneo task IDs, GitHub issues/PRs, and, if installed, Orchestrator session IDs.
- Approval record and immutable specification version for every execution request.
- Normalized statuses: `awaiting_runner`, `running`, `needs_input`, `in_review`, `failed`, `cancelled`, `completed`; do not equate `completed` with `released`.
- Idempotency, durable job events, audit data, cancellation and retry semantics.
- Typed adapters for future optional local runner / sandbox providers.

## MVP scope

The first integration uses GitHub issue intake and may not need a live execution service. Do not implement this package until an actual cross-component contract is necessary. Never expose Orchestrator's unauthenticated localhost API through the web product.
