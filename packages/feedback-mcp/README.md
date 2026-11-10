# Feedback-aware MCP tools

**Status:** documentation-only placeholder. **Milestone:** [M4](https://github.com/PlaybookMediaLLC/kaneo/issues/10).

Extend **Kaneo's existing MCP support** so a founder can use Claude Code, Codex, or another compatible client to inspect customer evidence and approved product work. Do **not** build or replace a second general MCP server unnecessarily.

## Proposed tools

- `get_product_context`, `list_feedback`, `get_feedback_evidence`, `find_related_feedback`.
- `propose_implementation`, `create_implementation_tasks` (subject to authorization), `report_implementation`, `prepare_release_notes`.
- Bounded search, pagination, safe output and source links back to the originating requests.

## Security contract

Reuse Kaneo's MCP OAuth/API-key and workspace authorization, with scoped read and mutation permissions. Treat customer text/attachments as untrusted inputs; never allow embedded feedback instructions to override access controls. Any write affecting GitHub, customers, releases or execution needs explicit permissions and appropriate user approval.

Users authenticate directly with their own Claude Code CLI; do **not** retrieve or store Claude subscription tokens. No MCP tools are implemented here yet.
