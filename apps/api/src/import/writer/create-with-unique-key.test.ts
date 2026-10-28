import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vite-plus/test";
import { createWithUniqueKey } from "./create-with-unique-key";

describe("createWithUniqueKey", () => {
  it("derives a key from the name and avoids existing keys in any case", async () => {
    const create = vi.fn(async (key: string) => key);

    await expect(
      createWithUniqueKey("Marketing Website Redesign", ["mwr"], create),
    ).resolves.toBe("MWR-2");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries with the next key when another request took it first", async () => {
    const create = vi.fn(async (key: string) => {
      if (key !== "ENGINE-3") {
        throw new HTTPException(409, { message: "taken" });
      }
      return key;
    });

    await expect(createWithUniqueKey("Engineering", [], create)).resolves.toBe(
      "ENGINE-3",
    );
    expect(create.mock.calls.map(([key]) => key)).toEqual([
      "ENGINEER",
      "ENGINE-2",
      "ENGINE-3",
    ]);
  });

  it("gives up after a few conflicts", async () => {
    const create = vi.fn<(key: string) => Promise<string>>(async () => {
      throw new HTTPException(409, { message: "taken" });
    });

    await expect(
      createWithUniqueKey("Ops", [], create, { attempts: 3 }),
    ).rejects.toThrow("taken");
    expect(create.mock.calls.map(([key]) => key)).toEqual([
      "OPS",
      "OPS-2",
      "OPS-3",
    ]);
  });

  it("uses the source key when it is free", async () => {
    const create = vi.fn(async (key: string) => key);

    await expect(
      createWithUniqueKey("Website", ["ENG"], create, { preferredKey: "web" }),
    ).resolves.toBe("WEB");
  });

  it("suffixes the source key when the workspace already uses it", async () => {
    const create = vi.fn(async (key: string) => key);

    await expect(
      createWithUniqueKey("Website", ["web", "WEB-2"], create, {
        preferredKey: "WEB",
      }),
    ).resolves.toBe("WEB-3");
  });

  it("keeps a long source key whole when suffixing it", async () => {
    const create = vi.fn(async (key: string) => key);

    await expect(
      createWithUniqueKey("Marketing", ["MARKETING"], create, {
        preferredKey: "MARKETING",
      }),
    ).resolves.toBe("MARKETING-2");
  });

  it("retries the source key on conflicts like a derived one", async () => {
    const create = vi.fn(async (key: string) => {
      if (key === "ENG") throw new HTTPException(409, { message: "taken" });
      return key;
    });

    await expect(
      createWithUniqueKey("Engineering", [], create, { preferredKey: "ENG" }),
    ).resolves.toBe("ENG-2");
    expect(create.mock.calls.map(([key]) => key)).toEqual(["ENG", "ENG-2"]);
  });

  it("falls back to the name when the source key has nothing usable", async () => {
    const create = vi.fn(async (key: string) => key);

    await expect(
      createWithUniqueKey("Marketing Website Redesign", [], create, {
        preferredKey: " -_ ",
      }),
    ).resolves.toBe("MWR");
  });

  it("does not retry other failures", async () => {
    const create = vi.fn(async () => {
      throw new Error("database down");
    });

    await expect(createWithUniqueKey("Ops", [], create)).rejects.toThrow(
      "database down",
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});
