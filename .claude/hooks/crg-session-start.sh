#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: builds the code-review-graph
# index in the background.
#
# The graph database (.code-review-graph/graph.db) is gitignored, so every new
# cloud container starts without one. A full build from the CLI takes about
# five minutes on a 4-core container (the MCP tool's single-threaded build
# takes over ten), well past the 60s MCP tool timeout, and while it runs the
# MCP tools answer from a partial graph without saying so. Starting the build
# detached here means the graph is usually ready by the time an agent needs
# it, and the context message below tells the agent how to check.
#
# Local sessions are left alone: developers run code-review-graph's own
# install, watch and update hooks there.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

if command -v code-review-graph >/dev/null 2>&1; then
  crg=(code-review-graph)
else
  crg=(uvx code-review-graph)
fi

# Runs detached from the hook. The lock stops a resume or compaction from
# starting a second build while the first is still writing to the database.
run_worker() {
  local repo="$1"
  exec 9>"$repo/.code-review-graph/session-build.lock"
  if ! flock -n 9; then
    echo "$(date -Is) another graph build is already running; exiting"
    return 0
  fi

  # An interrupted build leaves a database that `update` would only patch,
  # so anything short of a complete graph gets a full rebuild.
  local mode=build
  if "${crg[@]}" status --json --repo "$repo" 2>/dev/null |
    jq -e '.files > 0 and (.build_incomplete | not)' >/dev/null 2>&1; then
    mode=update
  fi

  echo "$(date -Is) starting code-review-graph $mode"
  local started=$SECONDS
  if "${crg[@]}" "$mode" --repo "$repo"; then
    echo "$(date -Is) finished code-review-graph $mode in $((SECONDS - started))s"
  else
    echo "$(date -Is) code-review-graph $mode FAILED with exit code $?"
  fi
}

if [ "${1:-}" = "--worker" ]; then
  run_worker "$2"
  exit 0
fi

cat >/dev/null || true

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v "${crg[0]}" >/dev/null 2>&1; then
  echo "code-review-graph: neither code-review-graph nor uvx is installed, so the graph was not built this session."
  exit 0
fi

repo="${CLAUDE_PROJECT_DIR:-$(pwd)}"
graph_dir="$repo/.code-review-graph"
log="$graph_dir/session-build.log"
had_graph=false
[ -f "$graph_dir/graph.db" ] && had_graph=true
mkdir -p "$graph_dir"

# Every descriptor is redirected so the hook returns at once instead of
# waiting on the build's output.
setsid nohup "${BASH_SOURCE[0]}" --worker "$repo" </dev/null >>"$log" 2>&1 &

if [ "$had_graph" = true ]; then
  what="a graph update (seconds if the existing graph is complete, a full rebuild if an earlier build was cut short)"
else
  what="a full graph build (about 5 minutes)"
fi
cat <<EOF
code-review-graph: started ${what} in the background; progress is logged to .code-review-graph/session-build.log.
While it runs, the code-review-graph MCP tools report success but answer from a partial graph, so an empty result does not prove the code is absent.
Before relying on graph results, run \`uvx code-review-graph status --json\` and wait for "build_incomplete": false with a nonzero "files" count, or for a "finished" line in the log.
Do not call build_or_update_graph_tool until it has finished.
EOF
