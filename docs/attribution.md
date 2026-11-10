# Attribution and third-party boundaries

This is a planning document, **not a substitute for legal review or a generated software bill of materials**.

## Existing upstream source

**Kaneo** — original project https://github.com/usekaneo/kaneo, fork at https://github.com/PlaybookMediaLLC/kaneo. The repository contains an MIT license. Retain the original copyright and permission notice in source and applicable distributions. Product-specific modifications should be distinguishable from upstream work.

**Agent Orchestrator / Orchestrator.inc** — https://github.com/OrchestratorInc/agent-orchestrator. Its public repository includes Apache-2.0 licensed source. For the MVP we do not modify, bundle, or relabel its desktop application; we link to the official download and integrate with its public GitHub issue intake. If a future submodule or binary distribution is added, preserve the relevant license, notices, modification records (if modified), and third-party obligations.

**UserJot** — product/UX reference only. No UserJot code, icons, copy, trademarks or visual assets are included or licensed through this project.

## Branding rule

A permissive source-code license does **not** mean permission to suggest affiliation, reuse trademarks, or copy third-party logos for an unrelated product. Product branding remains undecided and must be original. The documentation may name upstream dependencies accurately with attribution.

## Before any redistribution

1. Inspect the exact dependencies and bundled assets of the pinned release, including fonts/icons and third-party licenses.
2. Preserve license files and applicable NOTICE files.
3. Replace third-party product identifiers only where permitted and actually necessary; never remove copyright attribution.
4. Do not include Orchestrator's separate private cloud submodule or promise that it is redistributable.
5. Validate the Anthropic/other model-provider terms for the intended local or hosted execution arrangement.

See [upstream policy](upstream-policy.md).
