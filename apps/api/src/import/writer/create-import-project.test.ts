import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createImportProject } from "./create-import-project";

const mocks = vi.hoisted(() => ({
  insertUnplacedProject: vi.fn(),
  placeProject: vi.fn(),
  steps: [] as string[],
  transactions: [] as { id: number; outcome: "committed" | "rolled back" }[],
}));

vi.mock("../../database", () => ({
  default: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const tx = { id: mocks.transactions.length + 1 };
      try {
        const result = await work(tx);
        mocks.transactions.push({ ...tx, outcome: "committed" });
        return result;
      } catch (error) {
        mocks.transactions.push({ ...tx, outcome: "rolled back" });
        throw error;
      }
    },
  },
}));

vi.mock("../../project/controllers/insert-project", () => ({
  insertUnplacedProject: mocks.insertUnplacedProject,
  placeProject: mocks.placeProject,
}));

const input = {
  workspaceId: "workspace-1",
  name: "Website",
  userId: "user-1",
  preferredKey: "WEB",
};

function insertsProjects() {
  mocks.insertUnplacedProject.mockImplementation(async (_tx, project) => {
    mocks.steps.push(`insert ${project.slug}`);
    return { id: `project-${project.slug}`, slug: project.slug };
  });
}

describe("createImportProject", () => {
  beforeEach(() => {
    mocks.insertUnplacedProject.mockReset();
    mocks.placeProject.mockReset();
    mocks.steps = [];
    mocks.transactions = [];
  });

  it("inserts, fills, then places the project in one transaction", async () => {
    insertsProjects();
    mocks.placeProject.mockImplementation(async () => {
      mocks.steps.push("place");
    });
    const fill = vi.fn(async () => {
      mocks.steps.push("fill");
      return "filled";
    });

    await expect(createImportProject(input, fill)).resolves.toBe("filled");

    expect(mocks.steps).toEqual(["insert WEB", "fill", "place"]);
    const [tx] = mocks.insertUnplacedProject.mock.calls[0] ?? [];
    expect(mocks.insertUnplacedProject).toHaveBeenCalledWith(tx, {
      workspaceId: "workspace-1",
      name: "Website",
      icon: "Layout",
      slug: "WEB",
      userId: "user-1",
    });
    expect(fill).toHaveBeenCalledWith(tx, { id: "project-WEB", slug: "WEB" });
    expect(mocks.placeProject).toHaveBeenCalledWith(tx, {
      workspaceId: "workspace-1",
      projectId: "project-WEB",
      slug: "WEB",
    });
    expect(mocks.transactions).toEqual([{ id: 1, outcome: "committed" }]);
  });

  it("retries the whole transaction with the next key when placing finds the key taken", async () => {
    insertsProjects();
    mocks.placeProject
      .mockRejectedValueOnce(new HTTPException(409, { message: "taken" }))
      .mockResolvedValue(undefined);
    const fill = vi.fn(async () => "filled");

    await createImportProject(input, fill);

    expect(
      mocks.insertUnplacedProject.mock.calls.map(([, project]) => project.slug),
    ).toEqual(["WEB", "WEB-2"]);
    expect(fill).toHaveBeenCalledTimes(2);
    expect(mocks.transactions).toEqual([
      { id: 1, outcome: "rolled back" },
      { id: 2, outcome: "committed" },
    ]);
  });

  it("rolls the project back and never places it when filling fails", async () => {
    insertsProjects();
    const failure = new Error("could not write tasks");

    await expect(
      createImportProject(input, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(mocks.placeProject).not.toHaveBeenCalled();
    expect(mocks.transactions).toEqual([{ id: 1, outcome: "rolled back" }]);
  });
});
