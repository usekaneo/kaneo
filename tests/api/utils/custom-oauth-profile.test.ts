import { describe, expect, it } from "vite-plus/test";
import {
  mapCustomOAuthProfileToUser,
  readCustomOAuthPicture,
} from "../../../apps/api/src/utils/custom-oauth-profile";

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

  it("leaves the picture to Better Auth and preserves an unmanaged locale", () => {
    expect(
      mapCustomOAuthProfileToUser(
        {
          name: "Jane Doe",
          picture: "https://id.example.com/jane.png",
          locale: "de",
        },
        ["name"],
      ),
    ).toEqual({ name: "Jane Doe", locale: "de" });
  });

  it("maps a managed picture and locale", () => {
    expect(
      mapCustomOAuthProfileToUser(
        {
          name: "Jane Doe",
          picture: "https://id.example.com/jane.png",
          locale: "de",
        },
        ["image", "locale"],
      ),
    ).toEqual({
      name: "Jane Doe",
      image: "https://id.example.com/jane.png",
      locale: "de-DE",
    });
  });

  it("clears an unusable managed picture and locale", () => {
    expect(
      mapCustomOAuthProfileToUser(
        { name: "Jane Doe", picture: "javascript:alert(1)", locale: "sv" },
        ["image", "locale"],
      ),
    ).toEqual({ name: "Jane Doe", image: undefined, locale: null });
  });
});

describe("readCustomOAuthPicture", () => {
  const pictureOfLength = (length: number) => {
    const base = "https://id.example.com/";
    return `${base}${"a".repeat(length - base.length)}`;
  };

  it.each([
    "https://id.example.com/jane.png",
    "http://id.example.com/jane.png",
  ])("keeps %s", (picture) => {
    expect(readCustomOAuthPicture({ picture })).toBe(picture);
  });

  it("trims the claim", () => {
    expect(
      readCustomOAuthPicture({ picture: " https://id.example.com/jane.png " }),
    ).toBe("https://id.example.com/jane.png");
  });

  it.each([
    ["https:/api/auth/sign-out", "https://api/auth/sign-out"],
    ["https:id.example.com/jane.png", "https://id.example.com/jane.png"],
    ["http:/path", "http://path/"],
    ["https:\\api/x", "https://api/x"],
  ])("stores %p as the absolute URL %p", (picture, expected) => {
    expect(readCustomOAuthPicture({ picture })).toBe(expected);
  });

  it("accepts up to 2048 characters", () => {
    const picture = pictureOfLength(2048);
    expect(readCustomOAuthPicture({ picture })).toBe(picture);
    expect(readCustomOAuthPicture({ picture: pictureOfLength(2049) })).toBe(
      null,
    );
  });

  it("measures the length of the URL it stores", () => {
    const picture = `https://id.example.com/${"a b".repeat(600)}`;
    expect(picture.length).toBeLessThanOrEqual(2048);
    expect(readCustomOAuthPicture({ picture })).toBeNull();
  });

  it.each([
    undefined,
    "",
    42,
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/avatars/jane.png",
    "id.example.com/jane.png",
  ])("treats %p as absent", (picture) => {
    expect(readCustomOAuthPicture({ picture })).toBeNull();
  });
});
