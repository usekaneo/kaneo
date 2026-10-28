import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAdminAuditLog } from "./get-admin-audit-log";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    admin: {
      "audit-log": {
        $get: mocks.get,
      },
    },
  },
}));

const result = { entries: [], total: 0 };

describe("getAdminAuditLog", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({ ok: true, json: async () => result });
  });

  it("requests the first page of every action", async () => {
    await expect(getAdminAuditLog("", 0)).resolves.toEqual(result);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { page: "1", limit: "25" },
    });
  });

  it("filters by category and maps the zero-based page", async () => {
    await getAdminAuditLog("workspace", 2);

    expect(mocks.get).toHaveBeenCalledWith({
      query: { action: "workspace", page: "3", limit: "25" },
    });
  });

  it("throws an HttpError when the response is not ok", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ message: "Forbidden", code: "FORBIDDEN" }),
    });

    const error = await getAdminAuditLog("", 0).catch((caught) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
  });
});
