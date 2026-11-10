# Kaneo project instructions

Canonical guidance: [AGENTS.md](./AGENTS.md)

@AGENTS.md

## Ponytail and code-review-graph

- Load the `ponytail` skill at the start of every coding task and follow it: make the smallest change that fully solves the task. Where it conflicts with the rest of this repository's instructions, those instructions win.
- Use the code-review-graph MCP tools before Grep, Glob or Read to find code, callers, tests and the blast radius of a change. Cloud sessions build the graph in the background at startup, so until `uvx code-review-graph status --json` reports `"build_incomplete": false`, an empty result does not prove the code is absent.
