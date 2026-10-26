import { describe, expect, it } from "vite-plus/test";
import { getUserActionTypes } from "./get-user-action-types";

const options = { isSelf: false, canSendPasswordReset: true };

describe("getUserActionTypes", () => {
  it("offers verification actions only for unverified addresses", () => {
    expect(
      getUserActionTypes({ emailVerified: true, banned: false }, options),
    ).toEqual(["sendPasswordReset", "deactivate", "delete"]);
    expect(
      getUserActionTypes({ emailVerified: false, banned: true }, options),
    ).toEqual([
      "sendPasswordReset",
      "sendVerification",
      "markEmailVerified",
      "reactivate",
      "delete",
    ]);
  });

  it("never offers deactivating or deleting yourself", () => {
    expect(
      getUserActionTypes(
        { emailVerified: true, banned: false },
        { ...options, isSelf: true },
      ),
    ).toEqual(["sendPasswordReset"]);
  });

  it("hides reset links when password sign-in is off", () => {
    expect(
      getUserActionTypes(
        { emailVerified: true, banned: false },
        { ...options, canSendPasswordReset: false },
      ),
    ).toEqual(["deactivate", "delete"]);
  });
});
