import { describe, expect, it } from "vite-plus/test";
import { knownOptionKey } from "./contact-form";

describe("knownOptionKey", () => {
  const options = [{ key: "retailer" }, { key: "partner" }];

  it("keeps listed keys and empty values", () => {
    expect(knownOptionKey(options, "partner")).toBe("partner");
    expect(knownOptionKey(options, "")).toBe("");
  });

  it("drops a key whose option was deleted elsewhere", () => {
    expect(knownOptionKey(options, "distributor")).toBe("");
  });

  it("trusts the value while options are still loading", () => {
    expect(knownOptionKey(undefined, "distributor")).toBe("distributor");
  });
});
