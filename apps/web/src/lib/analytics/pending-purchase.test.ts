import { afterEach, describe, expect, it } from "vite-plus/test";
import { savePendingPurchase, takePendingPurchase } from "./pending-purchase";

afterEach(() => {
  sessionStorage.clear();
});

describe("pending purchase", () => {
  it("returns the saved purchase once", () => {
    savePendingPurchase({ plan: "team", interval: "annual" });

    expect(takePendingPurchase()).toEqual({ plan: "team", interval: "annual" });
    expect(takePendingPurchase()).toBeNull();
  });

  it("rejects unknown values", () => {
    sessionStorage.setItem("kaneo:pending-purchase", "enterprise-weekly");

    expect(takePendingPurchase()).toBeNull();
  });
});
