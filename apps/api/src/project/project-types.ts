export const PROJECT_TYPE_KEYS = [
  "development",
  "maintenance",
  "support",
  "hr",
  "marketing",
  "operations",
] as const;

export type ProjectTypeKey = (typeof PROJECT_TYPE_KEYS)[number];

export type ProjectTypeColumn = {
  name: string;
  slug: string;
  position: number;
  isFinal: boolean;
};

export type ProjectTypeTemplate = {
  key: ProjectTypeKey;
  columns: readonly ProjectTypeColumn[];
};

export const PROJECT_TYPE_TEMPLATES: Record<
  ProjectTypeKey,
  ProjectTypeTemplate
> = {
  development: {
    key: "development",
    columns: [
      { name: "Backlog", slug: "backlog", position: 0, isFinal: false },
      { name: "A Fazer", slug: "to-do", position: 1, isFinal: false },
      {
        name: "Em progresso",
        slug: "in-progress",
        position: 2,
        isFinal: false,
      },
      { name: "Em revisão", slug: "in-review", position: 3, isFinal: false },
      { name: "Finalizadas", slug: "done", position: 4, isFinal: true },
    ],
  },
  maintenance: {
    key: "maintenance",
    columns: [
      { name: "Triagem", slug: "triage", position: 0, isFinal: false },
      { name: "Em análise", slug: "in-analysis", position: 1, isFinal: false },
      { name: "Em correção", slug: "in-fix", position: 2, isFinal: false },
      { name: "Validação", slug: "validation", position: 3, isFinal: false },
      { name: "Concluído", slug: "done", position: 4, isFinal: true },
    ],
  },
  support: {
    key: "support",
    columns: [
      { name: "Novo", slug: "new", position: 0, isFinal: false },
      {
        name: "Em atendimento",
        slug: "in-attendance",
        position: 1,
        isFinal: false,
      },
      {
        name: "Aguardando cliente",
        slug: "waiting-customer",
        position: 2,
        isFinal: false,
      },
      { name: "Resolvido", slug: "done", position: 3, isFinal: true },
    ],
  },
  hr: {
    key: "hr",
    columns: [
      { name: "Currículos", slug: "resumes", position: 0, isFinal: false },
      { name: "Entrevista", slug: "interview", position: 1, isFinal: false },
      { name: "Proposta", slug: "offer", position: 2, isFinal: false },
      { name: "Contratado", slug: "hired", position: 3, isFinal: false },
      { name: "Arquivado", slug: "filed", position: 4, isFinal: true },
    ],
  },
  marketing: {
    key: "marketing",
    columns: [
      { name: "Ideias", slug: "ideas", position: 0, isFinal: false },
      { name: "Produção", slug: "production", position: 1, isFinal: false },
      { name: "Revisão", slug: "review", position: 2, isFinal: false },
      { name: "Publicado", slug: "published", position: 3, isFinal: true },
    ],
  },
  operations: {
    key: "operations",
    columns: [
      { name: "Solicitações", slug: "requests", position: 0, isFinal: false },
      {
        name: "Em andamento",
        slug: "in-progress",
        position: 1,
        isFinal: false,
      },
      { name: "Aprovação", slug: "approval", position: 2, isFinal: false },
      { name: "Concluído", slug: "done", position: 3, isFinal: true },
    ],
  },
};

export const DEFAULT_PROJECT_TYPE: ProjectTypeKey = "development";

export function isProjectTypeKey(value: string): value is ProjectTypeKey {
  return (PROJECT_TYPE_KEYS as readonly string[]).includes(value);
}

export function getProjectTypeTemplate(
  type: string | null | undefined,
): ProjectTypeTemplate {
  if (type && isProjectTypeKey(type)) {
    return PROJECT_TYPE_TEMPLATES[type];
  }
  return PROJECT_TYPE_TEMPLATES[DEFAULT_PROJECT_TYPE];
}

export const DEFAULT_PROJECT_COLUMNS =
  PROJECT_TYPE_TEMPLATES.development.columns;
