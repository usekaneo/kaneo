import { describe, expect, it } from "vite-plus/test";
import { describeError } from "./describe.js";
import * as Errors from "./errors.js";
import { isBuildError } from "./is-build-error.js";
import { toBuildError } from "./to-build-error.js";

const samples = [
  new Errors.PackageJsonMissing({ root: "/work/plugin" }),
  new Errors.PackageJsonInvalid({ message: "package.json is not an object" }),
  new Errors.EntryMissing(),
  new Errors.ViteMissing(),
  new Errors.ViteUnloadable({ detail: "boom" }),
  new Errors.ViteTooOld({ version: "6.3.0" }),
  new Errors.TypesFailed({ message: "TypeScript could not generate" }),
  new Errors.InvalidOutput({ problems: ["a", "b"] }),
  new Errors.BuildFailed({ message: "Unexpected token" }),
];

describe("describeError", () => {
  it("has a message for every error and recognizes it as a build error", () => {
    for (const error of samples) {
      expect(isBuildError(error)).toBe(true);
      expect(describeError(error).message.length).toBeGreaterThan(0);
    }
  });

  it("keeps the messages plugin authors already know", () => {
    expect(describeError(samples[0] as Errors.PackageJsonMissing).message).toBe(
      "No package.json in /work/plugin. Run kaneo-plugin build from the plugin's root folder.",
    );
    expect(describeError(samples[5] as Errors.ViteTooOld).message).toBe(
      "kaneo-plugin build needs Vite 7 or newer, found 6.3.0",
    );
    expect(describeError(samples[7] as Errors.InvalidOutput).message).toBe(
      "The build output is not a valid Kaneo plugin:\n  - a\n  - b",
    );
  });
});

describe("toBuildError", () => {
  it("keeps build errors and wraps anything else", () => {
    const missing = new Errors.EntryMissing();
    expect(toBuildError(missing)).toBe(missing);
    const wrapped = toBuildError(new Error("Unexpected token"));
    expect(wrapped._tag).toBe("BuildFailed");
    expect(describeError(wrapped).message).toBe("Unexpected token");
    expect(isBuildError({ _tag: "Other" })).toBe(false);
  });
});
