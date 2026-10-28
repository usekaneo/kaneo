import { describe, expect, it } from "vite-plus/test";
import {
  accessVerificationTone,
  isAccessVerified,
} from "./access-verification-tone";

const base = { message: "Message", failureReason: null };

describe("access verification", () => {
  it("is verified only with access and the required permissions", () => {
    expect(
      isAccessVerified({
        ...base,
        isInstalled: true,
        hasRequiredPermissions: true,
      }),
    ).toBe(true);
    expect(
      isAccessVerified({
        ...base,
        isInstalled: true,
        hasRequiredPermissions: false,
      }),
    ).toBe(false);
    expect(isAccessVerified(undefined)).toBe(false);
  });

  it("maps results to a tone", () => {
    expect(
      accessVerificationTone({
        ...base,
        isInstalled: true,
        hasRequiredPermissions: true,
      }),
    ).toBe("success");
    expect(
      accessVerificationTone({
        ...base,
        isInstalled: false,
        hasRequiredPermissions: false,
        failureReason: "repository_not_found",
      }),
    ).toBe("destructive");
    expect(
      accessVerificationTone({
        ...base,
        isInstalled: true,
        hasRequiredPermissions: false,
      }),
    ).toBe("warning");
  });
});
