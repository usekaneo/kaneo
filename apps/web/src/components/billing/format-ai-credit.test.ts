import { describe, expect, it } from "vite-plus/test";
import { formatAiCredit } from "./format-ai-credit";

describe("formatAiCredit", () => {
  it("shows balances in cents unless a nonzero balance would read $0.00", () => {
    expect(formatAiCredit("8283876", "en-US")).toBe("$8.28");
    expect(formatAiCredit("0", "en-US")).toBe("$0.00");
    expect(formatAiCredit("4200", "en-US")).toBe("$0.0042");
    expect(formatAiCredit("1", "en-US")).toBe("$0.000001");
  });
  it("keeps sub-cent ledger amounts and signs them", () => {
    expect(
      formatAiCredit("-312", "en-US", { maxDigits: 6, signed: true }),
    ).toBe("-$0.000312");
    expect(
      formatAiCredit("5000000", "en-US", { maxDigits: 6, signed: true }),
    ).toBe("+$5.00");
  });
});
