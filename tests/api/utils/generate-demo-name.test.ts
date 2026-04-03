import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDemoName } from "../../../apps/api/src/utils/generate-demo-name";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateDemoName", () => {
  it("returns an adjective-animal slug", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0);

    expect(generateDemoName()).toBe("fractious-monkfish");
  });

  it("stays hyphenated for later values too", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.9999)
      .mockReturnValueOnce(0.9999);

    expect(generateDemoName()).toBe("dynamic-lion");
  });
});
