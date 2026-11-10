# Integrations

**Status:** documentation-only directory.

Playbook-owned adapters connect approved product work to third-party interfaces **without vendoring their application logic**.

- [GitHub agent intake](github-agent-intake/README.md): approved Kaneo task -> suitably scoped GitHub issue for an opted-in coding agent.
- [Orchestrator](orchestrator/README.md): supported unmodified Orchestrator installation, setup instructions, compatibility and potentially a separate local companion later.

Integrations must be idempotent, tenant-aware, access-controlled, auditable and resilient when customers are offline. Reuse existing Kaneo GitHub and MCP facilities first. The source of truth for customer demand remains the feedback domain; the source of truth for product tasks remains Kaneo.
