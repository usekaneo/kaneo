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
});
