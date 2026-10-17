import type { ImportedColumn } from "../types.js";
import type { LinearWorkflowState } from "./client.js";

const STATE_TYPE_ORDER = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "duplicate",
];

const FINAL_STATE_TYPES = new Set(["completed", "canceled", "duplicate"]);

const BACKLOG_STATE_TYPES = new Set(["triage", "backlog"]);

const HIDDEN_WHEN_EMPTY = new Set(["duplicate"]);

export function orderStates(
  states: LinearWorkflowState[],
): LinearWorkflowState[] {
  return [...states].sort(
    (a, b) =>
      typeRank(a.type) - typeRank(b.type) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  );
}

export function mapColumns(
  states: LinearWorkflowState[],
  usedStateIds: ReadonlySet<string>,
): ImportedColumn[] {
  return orderStates(states)
    .filter((state) => !BACKLOG_STATE_TYPES.has(state.type))
    .filter(
      (state) =>
        !HIDDEN_WHEN_EMPTY.has(state.type) || usedStateIds.has(state.id),
    )
    .map((state) => ({
      key: state.id,
      name: state.name,
      isFinal: FINAL_STATE_TYPES.has(state.type),
    }));
}

function typeRank(type: string): number {
  const index = STATE_TYPE_ORDER.indexOf(type);
  return index === -1 ? STATE_TYPE_ORDER.length : index;
}
