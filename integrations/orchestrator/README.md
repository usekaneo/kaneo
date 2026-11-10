# Orchestrator integration

**Status:** documentation-only placeholder. **Milestones:** [M3](https://github.com/PlaybookMediaLLC/kaneo/issues/9), [M6](https://github.com/PlaybookMediaLLC/kaneo/issues/12), optional [M7](https://github.com/PlaybookMediaLLC/kaneo/issues/13).

Connect the Playbook feedback-to-development product with the **unmodified official Orchestrator.inc** desktop app and its existing GitHub issue-intake capability.

## MVP responsibilities

- Founder setup guide: install the official Orchestrator application, select a repository, authenticate GitHub and the official Claude Code/Codex/OpenCode CLI locally, and opt into issue intake.
- Compatibility checklist for supported Orchestrator releases and GitHub issue filters.
- Clear run handoff states and troubleshooting: opted-out, awaiting agent, no eligible runner, PR ready, failure.
- Links back to the **official** app/download and upstream documentation, without presenting Playbook as the Orchestrator vendor.

## Later, only if demanded

A Playbook-owned **local companion** may connect to Orchestrator's loopback daemon and relay authenticated status/events to Kaneo through an outbound connection. It must never expose the daemon's unauthenticated primary API to the internet, use Claude subscription tokens as an integration credential, or fork the upstream engine.

Orchestrator's branding is unchanged. The optional source submodule is documented in [vendor/orchestrator](../../vendor/orchestrator/README.md).
