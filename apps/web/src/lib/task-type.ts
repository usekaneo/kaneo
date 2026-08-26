import {
  DEFAULT_PROJECT_TYPE,
  isProjectTypeKey,
  type ProjectTypeKey,
} from "@/constants/project-types";

/**
 * Task type slugs allowed per process template.
 * Keep in sync with apps/api/src/project/task-types.ts.
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

export type TaskType = (typeof PROJECT_TASK_TYPES)[ProjectTypeKey][number];

/** Development types — legacy alias used by older call sites. */
export const TASK_TYPES = PROJECT_TASK_TYPES.development;

export const DEFAULT_TASK_TYPE = PROJECT_TASK_TYPES.development[0];

export function getTaskTypesForProject(
  projectType: string | null | undefined,
): readonly string[] {
  if (projectType && isProjectTypeKey(projectType)) {
    return PROJECT_TASK_TYPES[projectType];
  }
  return PROJECT_TASK_TYPES[DEFAULT_PROJECT_TYPE];
}

export function getDefaultTaskType(
  projectType: string | null | undefined,
): string {
  return getTaskTypesForProject(projectType)[0] ?? DEFAULT_TASK_TYPE;
}

export const DEFAULT_BRANCH_PATTERN = "{slug}{number}-{type}-{title}";
export const LEGACY_DEFAULT_BRANCH_PATTERN = "{slug}-{number}";

export function resolveBranchPattern(pattern?: string | null): string {
  if (!pattern || pattern === LEGACY_DEFAULT_BRANCH_PATTERN) {
    return DEFAULT_BRANCH_PATTERN;
  }
  return pattern;
}

export function slugifyBranchSegment(
  text: string | undefined,
  max = 50,
): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

export function generateTaskBranchName(
  pattern: string,
  projectSlug: string | undefined,
  taskNumber: number | null | undefined,
  taskTitle: string | undefined,
  taskType: string | null | undefined = DEFAULT_TASK_TYPE,
): string {
  if (!projectSlug || !taskNumber) return "";
  const resolved = resolveBranchPattern(pattern);
  const name = resolved
    .replace("{slug}", projectSlug.toLowerCase())
    .replace("{number}", taskNumber.toString())
    .replace("{type}", (taskType || DEFAULT_TASK_TYPE).toLowerCase())
    .replace("{title}", slugifyBranchSegment(taskTitle));

  if (name.length <= 100) return name;
  return name.slice(0, 100).replace(/-+$/, "");
}

/**
 * Task types that must never touch GitHub (no branch, repo link, or sync).
 * Keep in sync with apps/api/src/project/task-types.ts.
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
