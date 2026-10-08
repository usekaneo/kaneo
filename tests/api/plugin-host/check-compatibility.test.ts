import { describe, expect, it } from "vite-plus/test";
import { checkCompatibility } from "../../../apps/api/src/plugin-host/loader/check-compatibility";

const plugin = (engines: string | null) => ({
  packageName: "kaneo-plugin-progress",
  version: "1.2.0",
  engines,
});

describe("checkCompatibility", () => {
  it("accepts versions inside the range, including prereleases", () => {
    expect(checkCompatibility(plugin(">=2.29 <3"), "2.29.3")).toEqual({
      status: "ok",
    });
    expect(checkCompatibility(plugin(">=2.29 <3"), "2.30.0-rc.1")).toEqual({
      status: "ok",
    });
  });

  it("fails outside the range", () => {
    expect(checkCompatibility(plugin(">=2.31 <3"), "3.0.0")).toEqual({
      status: "fail",
      message: "1.2.0 supports Kaneo >=2.31 <3, this is Kaneo 3.0.0.",
    });
  });

  it("fails on an invalid range", () => {
    expect(checkCompatibility(plugin("banana"), "2.29.3")).toMatchObject({
      status: "fail",
    });
  });

  it("only warns when the range or the Kaneo version is unknown", () => {
    expect(checkCompatibility(plugin(null), "2.29.3")).toMatchObject({
      status: "warn",
    });
    expect(checkCompatibility(plugin(">=2 <3"), null)).toMatchObject({
      status: "warn",
    });
    expect(checkCompatibility(plugin(">=2 <3"), "dev")).toMatchObject({
      status: "warn",
    });
  });
});
