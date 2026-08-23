import { describe, expect, it } from "vitest";
import { mapCustomOAuthProfileToUser } from "../../../apps/api/src/utils/custom-oauth-profile";

describe("mapCustomOAuthProfileToUser", () => {
  it("uses the provider name when present", () => {
    expect(
      mapCustomOAuthProfileToUser({
        name: "Jane Doe",
        preferred_username: "jdoe",
        email: "jane@example.com",
      }),
    ).toEqual({ name: "Jane Doe" });
  });

  it("falls back to given and family name parts", () => {
    expect(
      mapCustomOAuthProfileToUser({
        given_name: "Jane",
        family_name: "Doe",
        preferred_username: "jdoe",
        email: "jane@example.com",
      }),
    ).toEqual({ name: "Jane Doe" });
  });

  it("falls back to preferred_username when name is missing", () => {
    expect(
      mapCustomOAuthProfileToUser({
        sub: "keycloak-user-id",
        email_verified: true,
        preferred_username: "jdoe",
        email: "jane@example.com",
      }),
    ).toEqual({ name: "jdoe" });
  });

  it("falls back to the email local part when no profile name is available", () => {
    expect(
      mapCustomOAuthProfileToUser({
        email: "jane@example.com",
      }),
    ).toEqual({ name: "jane" });
  });

  it("returns an empty mapping when no usable display value exists", () => {
    expect(mapCustomOAuthProfileToUser({ email: "" })).toEqual({});
  });

  it("does not assume the email is verified when trust is disabled", () => {
    const profile = {
      name: "Jane Doe",
      email: "jane@example.com",
      email_verified: true,
    };

    const result = mapCustomOAuthProfileToUser(profile, {
      assumeEmailVerified: false,
    });

    expect(result).toEqual({ name: "Jane Doe" });
  });

  it("assumes the email is verified when the provider omits the claim", () => {
    const profile = { name: "Jane Doe", email: "jane@example.com" };

    const result = mapCustomOAuthProfileToUser(profile, {
      assumeEmailVerified: true,
    });

    expect(result).toEqual({ name: "Jane Doe", emailVerified: true });
  });

  it("uses an explicitly verified email claim when trust is enabled", () => {
    const profile = {
      name: "Jane Doe",
      email: "jane@example.com",
      email_verified: true,
    };

    const result = mapCustomOAuthProfileToUser(profile, {
      assumeEmailVerified: true,
    });

    expect(result).toEqual({ name: "Jane Doe", emailVerified: true });
  });

  it("preserves an explicitly unverified email claim when trust is enabled", () => {
    const profile = {
      name: "Jane Doe",
      email: "jane@example.com",
      email_verified: false,
    };

    const result = mapCustomOAuthProfileToUser(profile, {
      assumeEmailVerified: true,
    });

    expect(result).toEqual({ name: "Jane Doe", emailVerified: false });
  });

  it.each(["false", "true", 0, 1, null])(
    "treats a malformed verification claim (%s) as unverified",
    (emailVerified) => {
      const profile = {
        name: "Jane Doe",
        email: "jane@example.com",
        email_verified: emailVerified,
      };

      const result = mapCustomOAuthProfileToUser(profile, {
        assumeEmailVerified: true,
      });

      expect(result).toEqual({ name: "Jane Doe", emailVerified: false });
    },
  );

  it("does not verify an email when the provider omits the email claim", () => {
    const profile = { name: "Jane Doe", email_verified: true };

    const result = mapCustomOAuthProfileToUser(profile, {
      assumeEmailVerified: true,
    });

    expect(result).toEqual({ name: "Jane Doe" });
  });
});
