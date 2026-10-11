import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createImportProject } from "./create-import-project";

const mocks = vi.hoisted(() => ({
  insertProject: vi.fn(),
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
  insertProject: mocks.insertProject,
}));

const input = {
  workspaceId: "workspace-1",
  name: "Website",
  userId: "user-1",
  preferredKey: "WEB",
};

describe("createImportProject", () => {
  beforeEach(() => {
    mocks.insertProject.mockReset();
    mocks.transactions = [];
  });

  it("creates the project and fills it in the same transaction", async () => {
    mocks.insertProject.mockImplementation(async (_tx, project) => ({
      id: "project-1",
      slug: project.slug,
    }));
    const fill = vi.fn(async () => "filled");

    await expect(createImportProject(input, fill)).resolves.toBe("filled");

    const [tx] = mocks.insertProject.mock.calls[0] ?? [];
    expect(fill).toHaveBeenCalledWith(tx, { id: "project-1", slug: "WEB" });
    expect(mocks.insertProject).toHaveBeenCalledWith(tx, {
      workspaceId: "workspace-1",
      name: "Website",
      icon: "Layout",
      slug: "WEB",
      userId: "user-1",
    });
    expect(mocks.transactions).toEqual([{ id: 1, outcome: "committed" }]);
  });

  it("retries the whole transaction with the next key when the key was taken", async () => {
    mocks.insertProject
      .mockRejectedValueOnce(new HTTPException(409, { message: "taken" }))
      .mockImplementation(async (_tx, project) => ({
        id: "project-1",
        slug: project.slug,
      }));
    const fill = vi.fn(async () => "filled");

    await createImportProject(input, fill);

    expect(
      mocks.insertProject.mock.calls.map(([, project]) => project.slug),
    ).toEqual(["WEB", "WEB-2"]);
    expect(fill).toHaveBeenCalledTimes(1);
    expect(fill).toHaveBeenCalledWith({ id: 2 }, expect.anything());
    expect(mocks.transactions).toEqual([
      { id: 1, outcome: "rolled back" },
      { id: 2, outcome: "committed" },
    ]);
  });

  it("rolls the project back when filling it fails", async () => {
    mocks.insertProject.mockResolvedValue({ id: "project-1", slug: "WEB" });
    const failure = new Error("could not write tasks");

    await expect(
      createImportProject(input, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(mocks.transactions).toEqual([{ id: 1, outcome: "rolled back" }]);
  });
});
