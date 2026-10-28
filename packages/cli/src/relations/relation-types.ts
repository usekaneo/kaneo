import { Result } from "effect";
import type { NewTaskRelation } from "../api/task-relations.js";
import { InvalidArgument } from "../errors/errors.js";

export const RELATION_TYPES = [
  "subtask-of",
  "parent-of",
  "blocks",
  "blocked-by",
  "relates-to",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export type RelationDirection = "outgoing" | "incoming";

const ALIASES: Readonly<Record<string, RelationType>> = {
  "subtask-of": "subtask-of",
  "child-of": "subtask-of",
  "parent-of": "parent-of",
  blocks: "blocks",
  "blocked-by": "blocked-by",
  "relates-to": "relates-to",
  "related-to": "relates-to",
  related: "relates-to",
};

const UNSUPPORTED = new Set(["duplicates", "duplicate-of", "duplicated-by"]);

const TYPE_HINT = `Use one of: ${RELATION_TYPES.join(", ")}.`;

export function normalizeRelationWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, "-");
}

export function parseRelationType(
  input: string,
): Result.Result<RelationType, InvalidArgument> {
  const word = normalizeRelationWord(input);
  const type = ALIASES[word];
  if (type) return Result.succeed(type);
  return Result.fail(
    new InvalidArgument({
      message: UNSUPPORTED.has(word)
        ? `Kaneo has no "${input.trim()}" relation.`
        : `"${input.trim()}" is not a relation type.`,
      hint: UNSUPPORTED.has(word)
        ? `${TYPE_HINT} relates-to is the closest match.`
        : TYPE_HINT,
    }),
  );
}

export function toApiRelation(
  type: RelationType,
  taskId: string,
  otherId: string,
): NewTaskRelation {
  switch (type) {
    case "subtask-of":
      return {
        sourceTaskId: otherId,
        targetTaskId: taskId,
        relationType: "subtask",
      };
    case "parent-of":
      return {
        sourceTaskId: taskId,
        targetTaskId: otherId,
        relationType: "subtask",
      };
    case "blocks":
      return {
        sourceTaskId: taskId,
        targetTaskId: otherId,
        relationType: "blocks",
      };
    case "blocked-by":
      return {
        sourceTaskId: otherId,
        targetTaskId: taskId,
        relationType: "blocks",
      };
    case "relates-to":
      return {
        sourceTaskId: taskId,
        targetTaskId: otherId,
        relationType: "related",
      };
  }
}

export type Perspective = {
  readonly type: string;
  readonly direction: RelationDirection;
};

export function perspectiveOf(
  relation: {
    readonly sourceTaskId: string;
    readonly relationType: string;
  },
  taskId: string,
): Perspective {
  const outgoing = relation.sourceTaskId === taskId;
  const direction: RelationDirection = outgoing ? "outgoing" : "incoming";
  switch (relation.relationType) {
    case "subtask":
      return { type: outgoing ? "parent-of" : "subtask-of", direction };
    case "blocks":
      return { type: outgoing ? "blocks" : "blocked-by", direction };
    case "related":
      return { type: "relates-to", direction };
    default:
      return { type: relation.relationType, direction };
  }
}

type Phrases = {
  readonly now: string;
  readonly noLonger: string;
  readonly not: string;
};

const PHRASES: Readonly<Record<RelationType, Phrases>> = {
  "subtask-of": {
    now: "is now a subtask of",
    noLonger: "is no longer a subtask of",
    not: "is not a subtask of",
  },
  "parent-of": {
    now: "is now the parent of",
    noLonger: "is no longer the parent of",
    not: "is not the parent of",
  },
  blocks: {
    now: "now blocks",
    noLonger: "no longer blocks",
    not: "does not block",
  },
  "blocked-by": {
    now: "is now blocked by",
    noLonger: "is no longer blocked by",
    not: "is not blocked by",
  },
  "relates-to": {
    now: "now relates to",
    noLonger: "no longer relates to",
    not: "is not related to",
  },
};

export function isRelationType(type: string): type is RelationType {
  return (RELATION_TYPES as ReadonlyArray<string>).includes(type);
}

export function linkedPhrase(type: RelationType): string {
  return PHRASES[type].now;
}

export function notLinkedPhrase(type: RelationType): string {
  return PHRASES[type].not;
}

export function unlinkedPhrase(type: string): string | null {
  return isRelationType(type) ? PHRASES[type].noLonger : null;
}

const HEADINGS: Readonly<Record<string, string>> = {
  "subtask-of": "Also a subtask of",
  "parent-of": "Parent of",
  blocks: "Blocks",
  "blocked-by": "Blocked by",
  "relates-to": "Related",
};

export function relationHeading(type: string): string {
  const known = HEADINGS[type];
  if (known) return known;
  const words = type.replace(/[-_]+/gu, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function relationOrder(type: string): number {
  const index = (RELATION_TYPES as ReadonlyArray<string>).indexOf(type);
  return index === -1 ? RELATION_TYPES.length : index;
}
