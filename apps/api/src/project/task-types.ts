import {
  DEFAULT_PROJECT_TYPE,
  isProjectTypeKey,
  type ProjectTypeKey,
} from "./project-types";

/**
 * Task type slugs allowed per process template.
 * Development keeps conventional Git-style types; other templates use
 * domain-oriented Portuguese slugs (ASCII) for branch naming.
 */
export const PROJECT_TASK_TYPES = {
  development: [
    "feat",
    "fix",
    "chore",
    "bug",
    "docs",
    "refactor",
    "test",
    "perf",
    "ci",
    "build",
    "style",
    "contract",
    "reuniao",
  ],
  maintenance: [
    "incidente",
    "melhoria",
    "patch",
    "hotfix",
    "chore",
    "bug",
    "reuniao",
  ],
  support: ["chamado", "duvida", "reclamacao", "solicitacao", "reuniao"],
  hr: [
    "curriculo",
    "entrevista",
    "proposta",
    "onboarding",
    "contract",
    "reuniao",
  ],
  marketing: ["campanha", "conteudo", "arte", "anuncio", "reuniao"],
  operations: [
    "implantacao",
    "consultoria",
    "treinamento",
    "auditoria",
    "solicitacao",
    "reuniao",
  ],
} as const satisfies Record<ProjectTypeKey, readonly string[]>;

/**
 * Always available in every project type (contracts & meetings).
 * Canonical slugs only — aliases are accepted via isUniversalTaskType.
 */
export const UNIVERSAL_TASK_TYPES = ["contract", "reuniao"] as const;

export type ProjectTaskType =
  (typeof PROJECT_TASK_TYPES)[ProjectTypeKey][number];

const ALL_TASK_TYPE_SET = new Set<string>([
  ...Object.values(PROJECT_TASK_TYPES).flat(),
  ...UNIVERSAL_TASK_TYPES,
]);

export const ALL_TASK_TYPES = [...ALL_TASK_TYPE_SET] as [
  string,
  string,
  ...string[],
];

/** @deprecated Prefer ALL_TASK_TYPES or getTaskTypesForProjectType */
export const VALID_TASK_TYPES = ALL_TASK_TYPES;

function withUniversalTaskTypes(types: readonly string[]): readonly string[] {
  const merged = [...types];
  for (const type of UNIVERSAL_TASK_TYPES) {
    if (!merged.includes(type)) {
      merged.push(type);
    }
  }
  return merged;
}

export function getTaskTypesForProjectType(
  projectType: string | null | undefined,
): readonly string[] {
  if (projectType && isProjectTypeKey(projectType)) {
    return withUniversalTaskTypes(PROJECT_TASK_TYPES[projectType]);
  }
  return withUniversalTaskTypes(PROJECT_TASK_TYPES[DEFAULT_PROJECT_TYPE]);
}

export function getDefaultTaskType(
  projectType: string | null | undefined,
): string {
  return getTaskTypesForProjectType(projectType)[0] ?? "feat";
}

export function isUniversalTaskType(
  taskType: string | null | undefined,
): boolean {
  if (!taskType) return false;
  const normalized = taskType.trim().toLowerCase();
  return (
    normalized === "contract" ||
    normalized === "contrato" ||
    normalized === "reuniao" ||
    normalized === "meeting"
  );
}

export function isValidTaskTypeForProject(
  taskType: string,
  projectType: string | null | undefined,
): boolean {
  if (isUniversalTaskType(taskType)) {
    return true;
  }
  return getTaskTypesForProjectType(projectType).includes(taskType);
}

export function isKnownTaskType(taskType: string): boolean {
  return ALL_TASK_TYPE_SET.has(taskType);
}

/**
 * Task types that must never touch GitHub (no branch, repo link, or issue sync).
 * Canonical slugs: `contract`, `reuniao`. Aliases accepted for safety.
 */
export const GITHUB_EXEMPT_TASK_TYPES = [
  "contract",
  "contrato",
  "reuniao",
  "meeting",
] as const;

const GITHUB_EXEMPT_TASK_TYPE_SET = new Set<string>(
  GITHUB_EXEMPT_TASK_TYPES.map((type) => type.toLowerCase()),
);

export function isGithubExemptTaskType(
  taskType: string | null | undefined,
): boolean {
  if (!taskType) return false;
  return GITHUB_EXEMPT_TASK_TYPE_SET.has(taskType.trim().toLowerCase());
}
