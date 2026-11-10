# Orchestrator optional submodule placeholder

**Status:** README only. **No Git submodule has been added.** **Milestone:** optional [M7](https://github.com/PlaybookMediaLLC/kaneo/issues/13).

The primary product plan uses the **unmodified** Orchestrator application downloaded from its official upstream project: https://github.com/OrchestratorInc/agent-orchestrator.

If source pinning later becomes necessary for local compatibility tests, first **remove this tracked placeholder directory** and then register a Git submodule at `vendor/orchestrator` pinned to a reviewed upstream commit. Preserve its license notices and do not initialize its private cloud submodule.

Changes to the submodule pointer will require review, tests and release compatibility checks. They will not rebrand the upstream app, publish any derivative executable, or update customers' local installations.

No code, assets, authentication or Go binaries are present in this directory now.
