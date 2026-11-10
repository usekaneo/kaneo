# Product planning and integration docs

This directory documents the planned feedback-to-development product built on the Playbook Media Kaneo fork. It is a planning scaffold, **not a declaration that these features are implemented**.

Start here:

- [UserJot parity matrix](userjot-parity.md): verified features, priorities, issue links, and acceptance journeys for M0/M1.
- [Architecture](architecture.md): product boundaries, data ownership, and feedback-to-release lifecycle.
- [Milestones](milestones/README.md): ordered delivery plan and tracking issues.
- [Upstream policy](upstream-policy.md): how to keep Kaneo and Orchestrator current without adopting upstream product ownership.
- [Attribution](attribution.md): current open-source provenance, brand boundaries, and required distribution review.

## Product decision

The external customer is an independent software founder. A customer reports a problem; the founder decides whether to build it; Kaneo manages the work; an **optional, unmodified Orchestrator** installation can act on an approved GitHub issue; GitHub verifies the PR; a confirmed release closes the loop with the requester.

The customer-facing name is undecided. Do not reuse the Kaneo, UserJot, or Orchestrator brands as the new product name.

Existing upstream packages and applications should not be moved just to match this planning structure. New directories remain README-only until their respective milestones begin.
