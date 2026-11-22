# ASTRYX UI Worktree Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-home the five uncommitted ASTRYX board UI changes in a clean worktree owned by the current Kaneo repository.

**Architecture:** Export only the approved UI paths from the source worktree, create the destination through OpenCode's native worktree manager from the current repository base, then apply and verify the patch. The source remains untouched as a rollback copy until the user explicitly requests cleanup.

**Tech Stack:** Git worktrees, OpenCode native worktree tools, pnpm, Vite+

**Spec:** `docs/superpowers/specs/2026-11-21-astryx-worktree-migration-design.md`

## Global Constraints

- Preserve all unrelated dirty files in both repositories.
- Transfer only the five approved web UI files.
- Do not commit, push, delete, prune, or force-remove a worktree.
- Use `/tmp/opencode` for the transfer patch.
- Prefer OpenCode's native worktree creation and session-move tools over raw `git worktree add`.

## Review Focus

- The source branch includes unrelated Telegram commits; none may appear in the destination diff.
- The source has an untracked `apps/site/AGENTS.md`; it must not be copied.
- The destination base is newer, so a patch conflict must stop automatic application and be resolved path-by-path without dropping newer code.
- The source worktree must remain byte-for-byte unchanged after transfer.
- The final destination diff must cover exactly the approved five paths and pass whitespace and web type checks.

---

### Task 1: Capture and fingerprint the source UI diff

**Files:**
- Read: `/home/hoalt/.local/share/opencode/worktree/db28ca/astryx-ui-pilot/apps/web/src/components/kanban-board/column/column-header.tsx`
- Read: `/home/hoalt/.local/share/opencode/worktree/db28ca/astryx-ui-pilot/apps/web/src/components/kanban-board/column/index.tsx`
- Read: `/home/hoalt/.local/share/opencode/worktree/db28ca/astryx-ui-pilot/apps/web/src/components/kanban-board/index.tsx`
- Read: `/home/hoalt/.local/share/opencode/worktree/db28ca/astryx-ui-pilot/apps/web/src/components/kanban-board/task-card/task-card-content.tsx`
- Read: `/home/hoalt/.local/share/opencode/worktree/db28ca/astryx-ui-pilot/apps/web/src/index.css`
- Create: `/tmp/opencode/astryx-ui-pilot.patch`

**Interfaces:**
- Produces: A patch containing only the five approved paths plus a SHA-256 fingerprint used after application.

- [ ] **Step 1:** Record `git status --short` in the source worktree and confirm the five modified UI paths plus the unrelated untracked site file.
- [ ] **Step 2:** Export `git diff --binary -- <five approved paths>` to `/tmp/opencode/astryx-ui-pilot.patch`.
- [ ] **Step 3:** Run `sha256sum /tmp/opencode/astryx-ui-pilot.patch` and retain the fingerprint for the verification report.
- [ ] **Step 4:** Re-run source `git status --short` and confirm exporting the patch changed nothing.

### Task 2: Create a clean native destination worktree

**Files:**
- Read: `/home/hoalt/ghcr/kaneo/.gitignore`
- Create: OpenCode-managed worktree named `astryx-board-ui`

**Interfaces:**
- Consumes: Current repository HEAD as the base.
- Produces: A clean destination directory returned by `tools.opencode.worktree_create`.

- [ ] **Step 1:** Confirm the current repository status and HEAD; preserve its existing untracked `docs/` content.
- [ ] **Step 2:** Create `astryx-board-ui` with `tools.opencode.worktree_create`.
- [ ] **Step 3:** Verify the returned directory belongs to the current repository's common Git directory and starts clean.
- [ ] **Step 4:** Install dependencies with `pnpm install --frozen-lockfile` only if the destination lacks a usable install.
- [ ] **Step 5:** Run `pnpm --filter @kaneo/web typecheck` as the clean baseline; stop and report if it fails.

### Task 3: Apply and verify the UI patch

**Files:**
- Modify: `apps/web/src/components/kanban-board/column/column-header.tsx`
- Modify: `apps/web/src/components/kanban-board/column/index.tsx`
- Modify: `apps/web/src/components/kanban-board/index.tsx`
- Modify: `apps/web/src/components/kanban-board/task-card/task-card-content.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: `/tmp/opencode/astryx-ui-pilot.patch` from Task 1.
- Produces: The ASTRYX UI diff on the current repository base, with no unrelated files.

- [ ] **Step 1:** Run `git apply --check /tmp/opencode/astryx-ui-pilot.patch` in the destination.
- [ ] **Step 2:** If the check passes, apply the patch normally; if it fails, stop automatic application and port only conflicting hunks path-by-path against the newer destination code.
- [ ] **Step 3:** Run `git diff --check` and require no whitespace errors.
- [ ] **Step 4:** Confirm `git diff --name-only` lists exactly the five approved paths.
- [ ] **Step 5:** Compare the source and destination UI intent with `git diff` for each approved path; account explicitly for any adaptation required by the newer base.
- [ ] **Step 6:** Run `pnpm exec vp check` for the five changed files and `pnpm --filter @kaneo/web typecheck`; require exit code 0.
- [ ] **Step 7:** Re-check source status and confirm the source worktree remains unchanged.

### Task 4: Attach tracking to the destination

**Files:** None.

**Interfaces:**
- Consumes: Verified destination directory from Task 3.
- Produces: This OpenCode session rooted in the new worktree.

- [ ] **Step 1:** Move the current OpenCode session with `tools.opencode.session_move` to the verified destination directory.
- [ ] **Step 2:** At the next safe boundary, confirm the session working directory and destination branch/status.
- [ ] **Step 3:** Report the destination path, branch, transferred paths, verification commands, and that the source backup was retained.
