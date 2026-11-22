# ASTRYX UI worktree migration — design

**Intent:** Move the in-progress ASTRYX board UI changes into a worktree owned
by the current Kaneo clone so its branch, diff, and OpenCode session are tracked
together.

**Chosen approach:** Create a clean native OpenCode worktree from the current
repository and transfer only the five uncommitted web UI files. Keep the source
worktree unchanged as a backup.

**Scope:** The five modified files under `apps/web/src/components/kanban-board/`
and `apps/web/src/index.css`.

**Non-goals:** Do not transfer the two Telegram commits, the untracked
`apps/site/AGENTS.md`, or unrelated files from either checkout. Do not commit,
push, or remove a worktree.

**Safety:** Capture a patch under `/tmp/opencode`, create the destination with
OpenCode's native worktree tool, verify the destination starts clean, apply the
patch, compare source and destination diffs, and run focused web checks before
moving this session to the destination.
