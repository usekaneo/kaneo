import { describe, it, expect } from "vite-plus/test";
import { generateId, toUuid, fromUuid } from "../core";
import { ID_PREFIXES } from "../prefixes";

describe("push_device TypeID", () => {
  it("is registered with the expected prefix string", () => {
    expect(ID_PREFIXES.push_device).toBe("push_device");
  });

  it("generates a prefixed id that round-trips through uuid", () => {
    const id = generateId("push_device");
    expect(id.startsWith("push_device_")).toBe(true);
    expect(fromUuid("push_device", toUuid(id))).toBe(id);
  });
});
