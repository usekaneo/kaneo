/**
 * Seed do workspace "Arquitetura Demo" (~200 tasks) com contratos, solicitações, orçamentos, TSC e contrastes de fluxo.
 *
 * Idempotente por slug `arquitetura-demo`. Use `--force` para recriar só esse workspace.
 *
 * Uso local (tunnel SSH ou Postgres acessível):
 *   DATABASE_URL=postgres://… pnpm --filter @kaneo/api db:seed:architecture
 *
 * Na EC2 (rede interna do compose):
 *   docker cp apps/api/scripts/seed-architecture-demo.mjs elsetasks-elsetasks-1:/tmp/
 *   docker exec -e POSTGRES_HOST=postgres -e POSTGRES_USER=… -e POSTGRES_PASSWORD=… \
 *     -e POSTGRES_DB=elsetasks elsetasks-elsetasks-1 node /tmp/seed-architecture-demo.mjs
 *
 * Credenciais demo: Demo123! (demo.*@elsetasks.local)
 * Owners: contato@elsesystems.com e samuelelse2@gmail.com (se existirem).
 */

import { DEFAULT_ROLE_NAMES, defaultRolePayloads } from "@kaneo/permissions";
import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const WORKSPACE_NAME = "Arquitetura Demo";
const WORKSPACE_SLUG = "arquitetura-demo";
const DEMO_PASSWORD = "Demo123!";
const FORCE = process.argv.includes("--force");
const TARGET_TASKS = 200;

const OWNER_EMAILS = ["contato@elsesystems.com"] as const;

type DemoUserDef = {
  email: string;
  name: string;
  roleHint: "owner" | "admin" | "member" | "viewer";
};

const DEMO_USERS: DemoUserDef[] = [
  { email: "demo.admin@elsetasks.local", name: "Ana Souza", roleHint: "owner" },
  {
    email: "demo.pm@elsetasks.local",
    name: "Bruno Oliveira",
    roleHint: "admin",
  },
  {
    email: "demo.dev1@elsetasks.local",
    name: "Carla Mendes",
    roleHint: "member",
  },
  {
    email: "demo.dev2@elsetasks.local",
    name: "Diego Santos",
    roleHint: "member",
  },
  {
    email: "demo.design@elsetasks.local",
    name: "Elena Costa",
    roleHint: "member",
  },
  {
    email: "demo.ops@elsetasks.local",
    name: "Felipe Rocha",
    roleHint: "member",
  },
  {
    email: "demo.viewer@elsetasks.local",
    name: "Gabriela Lima",
    roleHint: "viewer",
  },
  {
    email: "demo.hr@elsetasks.local",
    name: "Henrique Alves",
    roleHint: "member",
  },
];

type ProjectTypeKey =
  | "development"
  | "maintenance"
  | "support"
  | "hr"
  | "marketing"
  | "operations";

type ColumnDef = {
  name: string;
  slug: string;
  position: number;
  isFinal: boolean;
};

const PROJECT_TYPE_TEMPLATES: Record<
  ProjectTypeKey,
  { key: ProjectTypeKey; columns: readonly ColumnDef[] }
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

const PROJECT_TASK_TYPES: Record<ProjectTypeKey, readonly string[]> = {
  development: [
    "contract",
    "orcamento",
    "tsc",
    "reuniao",
    "solicitacao",
    "feat",
    "fix",
    "docs",
  ],
  maintenance: [
    "solicitacao",
    "contract",
    "orcamento",
    "tsc",
    "reuniao",
    "incidente",
    "melhoria",
  ],
  support: ["solicitacao", "reuniao", "tsc", "orcamento", "chamado", "duvida"],
  hr: [
    "contract",
    "reuniao",
    "solicitacao",
    "curriculo",
    "entrevista",
    "proposta",
  ],
  marketing: [
    "orcamento",
    "reuniao",
    "solicitacao",
    "campanha",
    "conteudo",
    "arte",
  ],
  operations: [
    "orcamento",
    "tsc",
    "contract",
    "solicitacao",
    "reuniao",
    "implantacao",
  ],
};

const GITHUB_EXEMPT = new Set([
  "contract",
  "contrato",
  "reuniao",
  "meeting",
  "solicitacao",
  "orcamento",
  "tsc",
]);

type FlowProfile = "completed" | "healthy" | "unhealthy" | "in_progress";

type ProjectSeed = {
  type: ProjectTypeKey;
  name: string;
  slug: string;
  icon: string;
  description: string;
  taskCount: number;
  flow: FlowProfile;
};

/** 6 projetos com contraste de fluxo para demo de dashboard. */
const PROJECTS: ProjectSeed[] = [
  {
    type: "development",
    name: "Residencial Vista Mar — BIM (fluindo bem)",
    slug: "residencial-vista-mar-bim",
    icon: "Home",
    description:
      "Projeto executivo residencial alto padrão (RVT/IFC). Fluxo saudável: poucas atrasadas, boa distribuição.",
    taskCount: 40,
    flow: "healthy",
  },
  {
    type: "maintenance",
    name: "Retrofit Edifício Aurora (não flui)",
    slug: "retrofit-edificio-aurora",
    icon: "Wrench",
    description:
      "Retrofit estrutural/fachada com gargalos: muitas urgentes e atrasadas nas colunas iniciais.",
    taskCount: 35,
    flow: "unhealthy",
  },
  {
    type: "support",
    name: "Acompanhamento de Obra — Moema (em andamento)",
    slug: "acompanhamento-obra-moema",
    icon: "Headphones",
    description:
      "Suporte ao canteiro com RFIs, solicitações e TSC — projeto em andamento.",
    taskCount: 32,
    flow: "in_progress",
  },
  {
    type: "hr",
    name: "People — Studio Arquitetura (concluído)",
    slug: "people-studio-arquitetura",
    icon: "Users",
    description:
      "Recrutamento concluído — projeto arquivado com a maioria das tasks finalizadas.",
    taskCount: 28,
    flow: "completed",
  },
  {
    type: "marketing",
    name: "Marca & Portfólio 2026 (concluído)",
    slug: "marca-portfolio-2026",
    icon: "Megaphone",
    description: "Campanha de marca entregue — projeto arquivado/concluído.",
    taskCount: 30,
    flow: "completed",
  },
  {
    type: "operations",
    name: "Implantação Interiores Jardins (em andamento)",
    slug: "implantacao-interiores-jardins",
    icon: "Settings",
    description:
      "Implantação de interiores com orçamentos, TSC e contratos — em andamento.",
    taskCount: 35,
    flow: "in_progress",
  },
];

const CLIENTS = [
  {
    name: "Horizonte Incorporações S.A.",
    tradeName: "Horizonte Inc.",
    cnpj: "11222333000181",
    email: "obras@horizonte-inc.demo.br",
    city: "São Paulo",
    state: "SP",
    partners: [
      {
        name: "Ricardo Almeida",
        role: "sócio-diretor",
        ownershipPercent: 60,
        email: "ricardo@horizonte-inc.demo.br",
      },
      {
        name: "Patricia Nogueira",
        role: "sócia-administrativa",
        ownershipPercent: 40,
        email: "patricia@horizonte-inc.demo.br",
      },
    ],
  },
  {
    name: "Aurora Asset Management Ltda",
    tradeName: "Aurora Asset",
    cnpj: "44555666000192",
    email: "facilities@aurora-asset.demo.br",
    city: "Rio de Janeiro",
    state: "RJ",
    partners: [
      {
        name: "Marcelo Vieira",
        role: "sócio-administrador",
        ownershipPercent: 100,
        email: "marcelo@aurora-asset.demo.br",
      },
    ],
  },
  {
    name: "Jardins Living Empreendimentos",
    tradeName: "Jardins Living",
    cnpj: "77888999000103",
    email: "projetos@jardinsliving.demo.br",
    city: "Curitiba",
    state: "PR",
    partners: [
      {
        name: "Sofia Ribeiro",
        role: "sócia",
        ownershipPercent: 50,
        email: "sofia@jardinsliving.demo.br",
      },
      {
        name: "André Campos",
        role: "sócio",
        ownershipPercent: 50,
        email: "andre@jardinsliving.demo.br",
      },
    ],
  },
];

const TASK_TITLES: Record<ProjectTypeKey, string[]> = {
  development: [
    "Modelar volumetria no Revit",
    "Compatibilizar MEP × estrutura",
    "Emitir planta de layout pavimento tipo",
    "Detalhar fachada ventilada",
    "Gerar quantitativos IFC",
    "Revisar memorial descritivo",
    "Contrato de projeto executivo",
    "Reunião de kickoff com incorporadora",
    "Ajustar cortes esquemáticos",
    "Exportar folhas para plotagem",
    "Corrigir conflito de shafts",
    "Documentar padrões BIM do escritório",
  ],
  maintenance: [
    "Inspecionar fissuras na laje",
    "Laudo de impermeabilização",
    "Hotfix em detalhe de peitoril",
    "Mapear patologia de revestimento",
    "Validar escoramento provisório",
    "Reunião com síndico e engenharia",
    "Atualizar cronograma de retrofit",
    "Patch em especificação de argamassa",
  ],
  support: [
    "RFI: detalhe de esquadria",
    "Dúvida sobre nível de contrapiso",
    "Reclamação de atraso de prancha",
    "Solicitação de revisão de cotas",
    "Reunião semanal de obra",
    "Esclarecer acabamento de hall",
  ],
  hr: [
    "Triagem currículo arquiteto pleno",
    "Entrevista técnica — BIM coordinator",
    "Proposta comercial estagiário",
    "Onboarding novo coordenador",
    "Contrato CLT arquiteto sênior",
    "Reunião de alinhamento People",
  ],
  marketing: [
    "Campanha LinkedIn portfólio",
    "Conteúdo: tour virtual residencial",
    "Arte para proposta comercial",
    "Anúncio Meta Ads escritório",
    "Reunião de briefing com marketing",
    "Case study Edifício Aurora",
  ],
  operations: [
    "Implantação de layout open space",
    "Consultoria de fluxo de obra",
    "Treinamento facilities",
    "Auditoria de checklist AS-BUILT",
    "Solicitação de liberação de área",
    "Reunião de go-live interiores",
  ],
};

const RICH_DESCRIPTIONS = [
  "<h3>Contexto</h3><p>Entrega alinhada ao cronograma do cliente e ao padrão de qualidade do studio.</p><ul><li>Revisar referências anexas</li><li>Validar com coordenação</li><li>Atualizar board após conclusão</li></ul>",
  "<p><strong>Escopo:</strong> detalhamento técnico + revisão cruzada com disciplina complementar.</p><p>Prazo crítico para medição da próxima quinzena.</p>",
  "<p>Inclui checklist de QA, link para pasta no drive do projeto e notas da última visita de obra.</p>",
];

const LABEL_DEFS = [
  { name: "urgente", color: "#DC2626" },
  { name: "cliente", color: "#2563EB" },
  { name: "bim", color: "#7C3AED" },
  { name: "obra", color: "#EA580C" },
  { name: "contrato", color: "#0F766E" },
  { name: "reuniao", color: "#0891B2" },
];

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;
const CONTRACT_STATUSES = ["pending", "sent", "completed", "declined"] as const;

const COMMENTS = [
  "Atualizei as pranchas na pasta compartilhada.",
  "Aguardando retorno do cliente para liberar a revisão.",
  "Compatibilização ok — pode seguir para plotagem.",
  "Vamos alinhar na reunião de quinta.",
  "Incluí o memorial no pacote de entrega.",
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(14, 0, 0, 0);
  return d;
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length] as T;
}

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const user = process.env.POSTGRES_USER ?? "elsetasks";
  const password = process.env.POSTGRES_PASSWORD ?? "elsetasks";
  const db = process.env.POSTGRES_DB ?? "elsetasks";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

async function ensureUser(
  pool: pg.Pool,
  def: DemoUserDef,
  passwordHash: string,
): Promise<{ id: string; email: string; name: string }> {
  const existing = await pool.query(
    `SELECT id, email, name FROM "user" WHERE email = $1 LIMIT 1`,
    [def.email],
  );
  if (existing.rows[0]) {
    const user = existing.rows[0] as {
      id: string;
      email: string;
      name: string;
    };
    const account = await pool.query(
      "SELECT id, password FROM account WHERE user_id = $1 LIMIT 1",
      [user.id],
    );
    if (!account.rows[0]) {
      await pool.query(
        `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
        [createId(), user.id, user.id, passwordHash],
      );
    } else if (!account.rows[0].password) {
      await pool.query(
        "UPDATE account SET password = $1, updated_at = NOW() WHERE id = $2",
        [passwordHash, account.rows[0].id],
      );
    }
    return user;
  }

  const userId = createId();
  await pool.query(
    `INSERT INTO "user" (id, name, email, email_verified, locale, created_at, updated_at)
     VALUES ($1, $2, $3, true, 'pt-BR', NOW(), NOW())`,
    [userId, def.name, def.email],
  );
  await pool.query(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
    [createId(), userId, userId, passwordHash],
  );
  return { id: userId, email: def.email, name: def.name };
}

async function main() {
  const totalPlanned = PROJECTS.reduce((s, p) => s + p.taskCount, 0);
  if (totalPlanned !== TARGET_TASKS) {
    console.warn(
      `⚠ soma de tasks planejadas = ${totalPlanned} (alvo ${TARGET_TASKS})`,
    );
  }

  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  console.log(`🌱 Seed ${WORKSPACE_NAME} (slug=${WORKSPACE_SLUG})`);
  console.log(`   force=${FORCE} tasks≈${totalPlanned}`);

  try {
    const existingWs = await pool.query(
      "SELECT id, slug FROM workspace WHERE slug = $1 LIMIT 1",
      [WORKSPACE_SLUG],
    );

    if (existingWs.rows[0] && !FORCE) {
      console.log(
        `⏭  workspace já existe (${WORKSPACE_SLUG}). Use --force para recriar.`,
      );
      return;
    }

    if (existingWs.rows[0] && FORCE) {
      console.log(`⚠️  --force: removendo workspace ${WORKSPACE_SLUG}…`);
      await pool.query("DELETE FROM workspace WHERE id = $1", [
        existingWs.rows[0].id,
      ]);
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const demoUsers = [];
    for (const def of DEMO_USERS) {
      const user = await ensureUser(pool, def, passwordHash);
      demoUsers.push({ ...user, roleHint: def.roleHint });
    }

    const ownerIds: string[] = [];
    for (const email of OWNER_EMAILS) {
      const res = await pool.query(
        `SELECT id, email FROM "user" WHERE lower(email) = lower($1) LIMIT 1`,
        [email],
      );
      if (res.rows[0]) {
        ownerIds.push(res.rows[0].id as string);
        console.log(`   owner: ${email}`);
      } else {
        console.log(`   ⚠ owner não encontrado (pulado): ${email}`);
      }
    }

    const now = new Date();
    const workspaceId = createId();
    const createdAt = daysAgo(60);

    await pool.query(
      `INSERT INTO workspace (id, name, slug, description, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        workspaceId,
        WORKSPACE_NAME,
        WORKSPACE_SLUG,
        "Workspace de demonstração de um escritório de arquitetura: BIM, retrofit, obra, people, marketing e implantação.",
        createdAt,
      ],
    );

    await pool.query(
      `INSERT INTO workspace_billing (id, workspace_id, founding_free, trial_ends_at, seats, created_at, updated_at)
       VALUES ($1, $2, true, $3, $4, $5, $6)`,
      [
        createId(),
        workspaceId,
        daysFromNow(90),
        Math.max(demoUsers.length + ownerIds.length, 12),
        createdAt,
        now,
      ],
    );

    for (const role of DEFAULT_ROLE_NAMES) {
      await pool.query(
        `INSERT INTO workspace_role (id, workspace_id, role, permission, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createId(),
          workspaceId,
          role,
          JSON.stringify(defaultRolePayloads[role]),
          createdAt,
          now,
        ],
      );
    }

    const seenMembers = new Set<string>();
    for (const ownerId of ownerIds) {
      if (seenMembers.has(ownerId)) continue;
      seenMembers.add(ownerId);
      await pool.query(
        `INSERT INTO workspace_member (id, workspace_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'owner', $4)`,
        [createId(), workspaceId, ownerId, createdAt],
      );
    }
    for (const u of demoUsers) {
      if (seenMembers.has(u.id)) continue;
      seenMembers.add(u.id);
      const role =
        u.roleHint === "owner" && ownerIds.length > 0 ? "admin" : u.roleHint;
      await pool.query(
        `INSERT INTO workspace_member (id, workspace_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [createId(), workspaceId, u.id, role, daysAgo(55)],
      );
    }

    const clientIds: string[] = [];
    for (let i = 0; i < CLIENTS.length; i++) {
      const c = CLIENTS[i]!;
      const clientId = createId();
      clientIds.push(clientId);
      await pool.query(
        `INSERT INTO client (
           id, workspace_id, name, trade_name, cnpj, email, phone,
           street, number, neighborhood, city, state, zip_code, country,
           notes, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,
           $8,$9,$10,$11,$12,$13,'BR',
           $14,$15,$16
         )`,
        [
          clientId,
          workspaceId,
          c.name,
          c.tradeName,
          c.cnpj,
          c.email,
          `11 9${1000 + i}${2000 + i}`,
          "Av. Brigadeiro Faria Lima",
          String(1500 + i * 100),
          "Itaim Bibi",
          c.city,
          c.state,
          "01452-000",
          "Cliente demo do pitch de arquitetura.",
          daysAgo(58 - i),
          now,
        ],
      );
      for (let p = 0; p < c.partners.length; p++) {
        const partner = c.partners[p]!;
        await pool.query(
          `INSERT INTO client_partner (
             id, client_id, name, role, ownership_percent, email, sort_order, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [
            createId(),
            clientId,
            partner.name,
            partner.role,
            partner.ownershipPercent,
            partner.email,
            p,
          ],
        );
      }
    }

    for (const label of LABEL_DEFS) {
      await pool.query(
        `INSERT INTO label (id, name, color, workspace_id, task_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,NULL,$5,$6)`,
        [createId(), label.name, label.color, workspaceId, createdAt, now],
      );
    }

    const templateId = createId();
    await pool.query(
      `INSERT INTO contract_template (
         id, workspace_id, name, original_filename, storage_key, mime_type,
         size_bytes, field_map, body_html, created_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)`,
      [
        templateId,
        workspaceId,
        "Contrato de Prestação de Serviços — Arquitetura",
        "contrato-arquitetura-demo.docx",
        `demo/${WORKSPACE_SLUG}/contrato-arquitetura.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        14_000,
        JSON.stringify([
          {
            placeholder: "cliente.razaoSocial",
            dataPath: "cliente.razaoSocial",
          },
          { placeholder: "cliente.cnpj", dataPath: "cliente.cnpj" },
        ]),
        "<p>Contrato demo entre o Studio e {{cliente.razaoSocial}} (CNPJ {{cliente.cnpj}}).</p>",
        demoUsers[0]?.id ?? ownerIds[0] ?? null,
        createdAt,
        now,
      ],
    );

    const assigneePool = demoUsers.map((u) => u.id);
    let taskTotal = 0;
    let commentTotal = 0;
    let contractTotal = 0;
    const columnStats: Record<string, number> = {};

    for (let p = 0; p < PROJECTS.length; p++) {
      const project = PROJECTS[p]!;
      const template = PROJECT_TYPE_TEMPLATES[project.type];
      const projectId = createId();
      const clientId = clientIds[p % clientIds.length]!;
      const projectCreated = daysAgo(50 - p * 4);

      await pool.query(
        `INSERT INTO project (
           id, workspace_id, slug, icon, name, description, project_type,
           client_id, created_at, is_public, last_task_number
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)`,
        [
          projectId,
          workspaceId,
          project.slug,
          project.icon,
          project.name,
          project.description,
          project.type,
          clientId,
          projectCreated,
          p === 0,
        ],
      );

      const columns: Array<{ id: string; slug: string; isFinal: boolean }> = [];
      for (const col of template.columns) {
        const columnId = createId();
        await pool.query(
          `INSERT INTO "column" (
             id, project_id, name, slug, position, is_final, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            columnId,
            projectId,
            col.name,
            col.slug,
            col.position,
            col.isFinal,
            projectCreated,
            now,
          ],
        );
        columns.push({
          id: columnId,
          slug: col.slug,
          isFinal: col.isFinal,
        });
      }

      const integrationId = createId();
      await pool.query(
        `INSERT INTO integration (id, project_id, type, config, is_active, created_at, updated_at)
         VALUES ($1,$2,'github',$3,true,$4,$5)`,
        [
          integrationId,
          projectId,
          JSON.stringify({
            repositoryOwner: "elsetasks-demo",
            repositoryName: project.slug,
            installationId: 42_000 + p,
          }),
          projectCreated,
          now,
        ],
      );

      const taskTypes = PROJECT_TASK_TYPES[project.type];
      const titles = TASK_TITLES[project.type];

      for (let t = 0; t < project.taskCount; t++) {
        const taskId = createId();
        const number = t + 1;
        const taskType = pick(taskTypes, t);
        const exempt = GITHUB_EXEMPT.has(taskType);
        const assignee = t % 6 === 0 ? null : pick(assigneePool, t + p);
        const created = daysAgo(((t * 3 + p * 7) % 75) + 1);
        const startDate = t % 3 === 0 ? daysAgo(((t + 5) % 30) + 1) : null;

        const finalCols = columns.filter((c) => c.isFinal);
        const earlyCols = columns.filter((c) => !c.isFinal);
        const midCols = earlyCols.filter((_, idx) => idx > 0);
        let column = columns[t % columns.length]!;
        let priority = pick(PRIORITIES, t + p);
        let dueDate: Date;

        if (project.flow === "completed") {
          column = pick(finalCols.length ? finalCols : columns, t);
          priority = pick(["low", "medium", "no-priority"] as const, t);
          dueDate = daysAgo(20 + (t % 40));
        } else if (project.flow === "healthy") {
          if (finalCols.length && t % 3 === 0) column = pick(finalCols, t);
          else if (midCols.length && t % 2 === 0) column = pick(midCols, t);
          else column = pick(earlyCols.length ? earlyCols : columns, t);
          priority = pick(["medium", "low", "high", "medium"] as const, t);
          dueDate = t % 10 === 0 ? daysAgo(2) : daysFromNow(3 + (t % 25));
        } else if (project.flow === "unhealthy") {
          column = pick(earlyCols.length ? earlyCols : columns, t);
          if (t % 8 === 0 && midCols.length) column = pick(midCols, t);
          priority = pick(
            ["urgent", "high", "urgent", "high", "medium"] as const,
            t,
          );
          dueDate = t % 5 === 0 ? daysFromNow(5) : daysAgo(3 + (t % 30));
        } else {
          column = pick(earlyCols.length ? earlyCols : columns, t);
          if (finalCols.length && t % 4 === 0) column = pick(finalCols, t);
          priority = pick(["medium", "high", "low", "medium"] as const, t);
          dueDate =
            t % 6 === 0 ? daysAgo(1 + (t % 8)) : daysFromNow(2 + (t % 20));
        }
        const description =
          t % 5 === 0
            ? pick(RICH_DESCRIPTIONS, t)
            : `<p>${pick(titles, t)} — projeto <strong>${project.name}</strong>.</p>`;

        await pool.query(
          `INSERT INTO task (
             id, project_id, position, number, assignee_id, title, description,
             status, column_id, priority, task_type, start_date, due_date,
             github_repository_owner, github_repository_name, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,
             $8,$9,$10,$11,$12,$13,
             $14,$15,$16,$17
           )`,
          [
            taskId,
            projectId,
            t,
            number,
            assignee,
            `${pick(titles, t + p)} (#${number})`,
            description,
            column.slug,
            column.id,
            priority,
            taskType,
            startDate,
            dueDate,
            !exempt && t % 7 === 0 ? "elsetasks-demo" : null,
            !exempt && t % 7 === 0 ? project.slug : null,
            created,
            column.isFinal ? daysAgo(t % 10) : created,
          ],
        );
        taskTotal += 1;
        columnStats[`${project.type}/${column.slug}`] =
          (columnStats[`${project.type}/${column.slug}`] ?? 0) + 1;

        if (assignee && t % 4 === 0) {
          const second = pick(assigneePool, t + 3);
          if (second !== assignee) {
            await pool.query(
              `INSERT INTO task_assignee (id, task_id, user_id, sort_order, created_at, updated_at)
               VALUES ($1,$2,$3,0,NOW(),NOW()), ($4,$5,$6,1,NOW(),NOW())
               ON CONFLICT (task_id, user_id) DO NOTHING`,
              [createId(), taskId, assignee, createId(), taskId, second],
            );
          } else {
            await pool.query(
              `INSERT INTO task_assignee (id, task_id, user_id, sort_order, created_at, updated_at)
               VALUES ($1,$2,$3,0,NOW(),NOW())
               ON CONFLICT (task_id, user_id) DO NOTHING`,
              [createId(), taskId, assignee],
            );
          }
        } else if (assignee && t % 2 === 0) {
          await pool.query(
            `INSERT INTO task_assignee (id, task_id, user_id, sort_order, created_at, updated_at)
             VALUES ($1,$2,$3,0,NOW(),NOW())
             ON CONFLICT (task_id, user_id) DO NOTHING`,
            [createId(), taskId, assignee],
          );
        }

        if (t % 3 === 0) {
          const label = pick(LABEL_DEFS, t + p);
          await pool.query(
            `INSERT INTO label (id, name, color, workspace_id, task_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              createId(),
              label.name,
              label.color,
              workspaceId,
              taskId,
              created,
              now,
            ],
          );
        }

        if (t % 4 === 0) {
          await pool.query(
            `INSERT INTO comment (id, task_id, user_id, content, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,NOW())`,
            [
              createId(),
              taskId,
              pick(assigneePool, t),
              pick(COMMENTS, t),
              daysAgo(t % 20),
            ],
          );
          commentTotal += 1;
        }

        if (t % 5 === 0) {
          await pool.query(
            `INSERT INTO activity (id, task_id, type, user_id, content, created_at, updated_at)
             VALUES ($1,$2,'status_changed',$3,$4,$5,$5)`,
            [
              createId(),
              taskId,
              pick(assigneePool, t + 1),
              `Status → ${column.slug}`,
              daysAgo(t % 12),
            ],
          );
        }

        if (!exempt && t % 9 === 0) {
          const prNumber = 200 + p * 50 + t;
          await pool.query(
            `INSERT INTO external_link (
               id, task_id, integration_id, resource_type, external_id, url, title, metadata, created_at, updated_at
             ) VALUES ($1,$2,$3,'pull_request',$4,$5,$6,$7,NOW(),NOW())`,
            [
              createId(),
              taskId,
              integrationId,
              String(prNumber),
              `https://github.com/elsetasks-demo/${project.slug}/pull/${prNumber}`,
              `PR #${prNumber}`,
              JSON.stringify({
                state: column.isFinal ? "merged" : "open",
              }),
            ],
          );
        }

        // Contratos mock (DocuSeal id sintético) — só em tipos contract
        if (taskType === "contract" && contractTotal < 12) {
          const status = pick(CONTRACT_STATUSES, contractTotal);
          await pool.query(
            `INSERT INTO contract_submission (
               id, workspace_id, project_id, task_id, client_id, template_id,
               docuseal_submission_id, status, submitters, created_by, created_at, updated_at
             ) VALUES (
               $1,$2,$3,$4,$5,$6,
               $7,$8,$9::jsonb,$10,$11,NOW()
             )`,
            [
              createId(),
              workspaceId,
              projectId,
              taskId,
              clientId,
              templateId,
              `arch-demo-sub-${createId().slice(0, 12)}`,
              status,
              JSON.stringify([
                {
                  name: "Sócio Cliente",
                  email: `assinatura+${contractTotal}@arquitetura.demo.br`,
                  role: "cliente",
                  status,
                },
              ]),
              demoUsers[0]?.id ?? null,
              daysAgo(10 + contractTotal),
            ],
          );
          contractTotal += 1;
        }
      }

      await pool.query(
        "UPDATE project SET last_task_number = $1 WHERE id = $2",
        [project.taskCount, projectId],
      );
      if (project.flow === "completed") {
        await pool.query("UPDATE project SET archived_at = $1 WHERE id = $2", [
          daysAgo(14),
          projectId,
        ]);
      }
      console.log(
        `   ✓ ${project.name} (${project.type}): ${project.taskCount} tasks / ${columns.length} colunas`,
      );
    }

    for (const u of demoUsers.slice(0, 5)) {
      for (let n = 0; n < 3; n++) {
        await pool.query(
          `INSERT INTO notification (
             id, user_id, title, content, type, is_read, resource_type, resource_id, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,'workspace',$7,$8,NOW())`,
          [
            createId(),
            u.id,
            pick(
              [
                "Tarefa atribuída a você",
                "Contrato aguardando assinatura",
                "Reunião de obra amanhã",
                "Prazo de entrega próximo",
              ],
              n,
            ),
            `Atualização em ${WORKSPACE_NAME}`,
            pick(["info", "warning", "success"], n),
            n % 2 === 0,
            workspaceId,
            daysAgo(n + 1),
          ],
        );
      }
    }

    const stats = await pool.query(
      `
      SELECT
        (SELECT count(*)::int FROM project WHERE workspace_id = $1) AS projects,
        (SELECT count(*)::int FROM task t
           JOIN project p ON p.id = t.project_id
           WHERE p.workspace_id = $1) AS tasks,
        (SELECT count(*)::int FROM client WHERE workspace_id = $1) AS clients,
        (SELECT count(*)::int FROM comment c
           JOIN task t ON t.id = c.task_id
           JOIN project p ON p.id = t.project_id
           WHERE p.workspace_id = $1) AS comments,
        (SELECT count(*)::int FROM contract_submission WHERE workspace_id = $1) AS contracts
      `,
      [workspaceId],
    );

    const byColumn = await pool.query(
      `
      SELECT p.project_type, c.slug AS column_slug, count(*)::int AS n
      FROM task t
      JOIN project p ON p.id = t.project_id
      JOIN "column" c ON c.id = t.column_id
      WHERE p.workspace_id = $1
      GROUP BY p.project_type, c.slug, c.position
      ORDER BY p.project_type, c.position
      `,
      [workspaceId],
    );

    console.log("\n✅ Seed Arquitetura Demo concluído");
    console.log("   workspace:", WORKSPACE_NAME, `(${WORKSPACE_SLUG})`);
    console.log("   id:", workspaceId);
    console.log("   contagens:", stats.rows[0]);
    console.log("   tasks inseridas:", taskTotal);
    console.log("   comentários:", commentTotal);
    console.log("   contract_submission:", contractTotal);
    console.log("\n   Distribuição por coluna:");
    for (const row of byColumn.rows) {
      console.log(`     ${row.project_type}/${row.column_slug}: ${row.n}`);
    }
    console.log("\nLogin sugerido:");
    console.log(`   ${OWNER_EMAILS[0]} (owner, conta real)`);
    console.log(`   demo.admin@elsetasks.local / ${DEMO_PASSWORD}`);
    console.log(
      `\nAbrir: https://appelsetasks.elsesystems.com → switcher → ${WORKSPACE_NAME}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Seed falhou:", err);
  process.exitCode = 1;
});
