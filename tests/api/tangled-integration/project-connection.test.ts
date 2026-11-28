import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  project: vi.fn(),
  integration: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  repository: vi.fn(),
}));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      projectTable: { findFirst: m.project },
      integrationTable: { findFirst: m.integration },
    },
    insert: m.insert,
    update: m.update,
    delete: m.delete,
  },
}));

vi.mock("../../../apps/api/src/plugins/tangled/read-client", () => ({
  createTangledReadClient: () => ({ getRepository: m.repository }),
}));

const { getTangledIntegration } =
  await import("../../../apps/api/src/tangled-integration/controllers/project-connection");
const { default: createTangledIntegration } =
  await import("../../../apps/api/src/tangled-integration/controllers/create-tangled-integration");
const { default: updateTangledIntegration } =
  await import("../../../apps/api/src/tangled-integration/controllers/update-tangled-integration");

const body = {
  baseUrl: "https://tangled.example",
  repositoryId: "did:plc:owner/rkey",
  repositoryDid: "did:plc:sjazesp3pinxlmgju2va46jd",
  repositoryUrl: "https://tangled.example/owner/repo",
  branchPattern: "{number}",
  isActive: true,
  webhookSecret: "secret-value",
};

beforeEach(() => {
  vi.resetAllMocks();
  m.project.mockResolvedValue({ id: "project" });
  m.integration.mockResolvedValue(null);
  m.repository.mockResolvedValue({
    repositoryDid: body.repositoryDid,
    webhookRepositoryFullName: body.repositoryId,
  });
});

describe("Tangled project connection", () => {
  it("maps the API shape to TangledConfig and excludes secret bytes from output", async () => {
    const inserted = {
      id: "integration",
      projectId: "project",
      config: JSON.stringify({
        origin: body.baseUrl,
        repositoryDid: body.repositoryDid,
        repositoryFullName: body.repositoryId,
        repositoryUrl: body.repositoryUrl,
        branchPattern: body.branchPattern,
        webhookSecret: body.webhookSecret,
        active: true,
      }),
      isActive: true,
    };
    m.insert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [inserted] }),
      }),
    });
    m.integration.mockResolvedValueOnce(null).mockResolvedValueOnce(inserted);
    const result = await createTangledIntegration({
      projectId: "project",
      body,
    });
    expect(result).toMatchObject({
      integrationId: "integration",
      repositoryDid: body.repositoryDid,
      hasSecret: true,
    });
    expect(JSON.stringify(result)).not.toContain(body.webhookSecret);
  });

  it("rejects a webhook identity that does not belong to the repository DID", async () => {
    m.repository.mockResolvedValue({
      repositoryDid: body.repositoryDid,
      webhookRepositoryFullName: "did:plc:other/repo",
    });
    await expect(
      createTangledIntegration({ projectId: "project", body }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("does not activate a connection when its repository cannot be checked", async () => {
    m.repository.mockRejectedValue(new Error("upstream-sensitive-body"));
    await expect(
      createTangledIntegration({ projectId: "project", body }),
    ).rejects.toMatchObject({ status: 502 });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("returns conflict when a concurrent insert wins", async () => {
    m.insert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [] }),
      }),
    });
    await expect(
      createTangledIntegration({ projectId: "project", body }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects duplicate connection creation without mutating the existing integration", async () => {
    m.integration.mockResolvedValue({
      id: "existing",
      config: "{}",
      isActive: true,
    });
    await expect(
      createTangledIntegration({ projectId: "project", body }),
    ).rejects.toMatchObject({ status: 409 });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("preserves the existing secret when patch omits webhookSecret", async () => {
    const config = {
      repositoryDid: body.repositoryDid,
      origin: body.baseUrl,
      repositoryFullName: body.repositoryId,
      repositoryUrl: body.repositoryUrl,
      branchPattern: body.branchPattern,
      webhookSecret: body.webhookSecret,
      active: true,
    };
    const row = {
      id: "integration",
      projectId: "project",
      config: JSON.stringify(config),
      isActive: true,
    };
    m.integration.mockResolvedValue(row);
    let savedConfig = "";
    let updateCondition = "";
    m.update.mockReturnValue({
      set: (values: { config: string }) => {
        savedConfig = values.config;
        return {
          where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
            updateCondition = new PgDialect().sqlToQuery(condition).sql;
            return { returning: async () => [{ id: row.id }] };
          },
        };
      },
    });
    await updateTangledIntegration({
      projectId: "project",
      body: { isActive: false },
    });
    expect(JSON.parse(savedConfig).webhookSecret).toBe(body.webhookSecret);
    expect(JSON.parse(savedConfig).active).toBe(false);
    expect(updateCondition).toContain('"is_active"');
  });

  it("returns the server-configured public webhook URL", async () => {
    vi.stubEnv("KANEO_API_URL", "https://api.example.test/api/");
    try {
      const config = {
        ...body,
        origin: body.baseUrl,
        repositoryFullName: body.repositoryId,
        active: true,
      };
      m.integration.mockResolvedValue({
        id: "integration",
        projectId: "project",
        config: JSON.stringify(config),
        isActive: true,
      });
      await expect(getTangledIntegration("project")).resolves.toMatchObject({
        webhookUrl:
          "https://api.example.test/api/tangled-integration/webhook/integration",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns a secret-free, project-scoped read model", async () => {
    const config = {
      ...body,
      origin: body.baseUrl,
      repositoryFullName: body.repositoryId,
      active: true,
    };
    m.integration.mockResolvedValue({
      id: "integration",
      projectId: "project",
      config: JSON.stringify(config),
      isActive: true,
    });
    const result = await getTangledIntegration("project");
    expect(JSON.stringify(result)).not.toContain(body.webhookSecret);
    expect(result).toMatchObject({
      repositoryId: body.repositoryId,
      hasSecret: true,
    });
  });
});
