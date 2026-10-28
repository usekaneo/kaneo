import { describe, expect, it } from "vite-plus/test";
import {
  rememberCustomOAuthProfile,
  runCustomOAuthCallback,
  takeCustomOAuthProfile,
} from "../../../apps/api/src/utils/custom-oauth-sign-in";

describe("custom OAuth sign-in profile", () => {
  it("keeps nothing outside a callback", () => {
    rememberCustomOAuthProfile({ sub: "sub-1" });
    expect(takeCustomOAuthProfile()).toBeUndefined();
  });

  it("hands the profile over once within a callback", async () => {
    const taken = await runCustomOAuthCallback(async () => {
      await Promise.resolve();
      rememberCustomOAuthProfile({ sub: "sub-1" });
      await Promise.resolve();
      return [takeCustomOAuthProfile(), takeCustomOAuthProfile()];
    });
    expect(taken).toEqual([{ sub: "sub-1" }, undefined]);
  });

  it("keeps concurrent callbacks apart", async () => {
    const signIn = (sub: string) =>
      runCustomOAuthCallback(async () => {
        rememberCustomOAuthProfile({ sub });
        await new Promise((resolve) => setTimeout(resolve, 5));
        return takeCustomOAuthProfile();
      });
    await expect(Promise.all([signIn("a"), signIn("b")])).resolves.toEqual([
      { sub: "a" },
      { sub: "b" },
    ]);
  });
});
