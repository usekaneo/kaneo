import { describe, expect, it } from "vite-plus/test";
import { errorMessage } from "./error-message.js";

describe("errorMessage", () => {
  it("reads errors and other thrown values without terminal styling", () => {
    expect(
      errorMessage(new Error("\u001b[31m[vite]\u001b[0m Unexpected token")),
    ).toBe("[vite] Unexpected token");
    expect(errorMessage("plain")).toBe("plain");
  });
});
