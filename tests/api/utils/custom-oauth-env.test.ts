import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  assertCustomOAuthEnv,
  parseCustomOAuthAccountUrl,
  parseManagedProfileFields,
} from "../../../apps/api/src/utils/custom-oauth-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseManagedProfileFields", () => {
  it.each(["", " , ,"])("manages nothing for %p", (value) => {
    expect(parseManagedProfileFields(value)).toEqual([]);
  });

  it("reads CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS by default", () => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "image");
    expect(parseManagedProfileFields()).toEqual(["image"]);
  });

  it("trims, ignores case and empty entries, and keeps a stable order", () => {
    expect(parseManagedProfileFields(" Locale ,IMAGE,, name ")).toEqual([
      "name",
      "image",
      "locale",
    ]);
  });

  it("lists a repeated field once", () => {
    expect(parseManagedProfileFields("name,NAME")).toEqual(["name"]);
  });

  it("refuses an unknown field", () => {
    expect(() => parseManagedProfileFields("name, avatar")).toThrow(
      'CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS accepts name, image and locale, not "avatar".',
    );
  });
});

describe("parseCustomOAuthAccountUrl", () => {
  it.each(["", "  "])("is unset for %p", (value) => {
    expect(parseCustomOAuthAccountUrl(value)).toBeNull();
  });

  it.each([
    [
      " https://keycloak.example.com/realms/acme/account ",
      "https://keycloak.example.com/realms/acme/account",
    ],
    ["http://id.example.com", "http://id.example.com/"],
  ])("accepts %p", (value, expected) => {
    expect(parseCustomOAuthAccountUrl(value)).toBe(expected);
  });

  it.each([
    "ftp://id.example.com/account",
    "javascript:alert(1)",
    "/realms/acme/account",
    "not a url",
  ])("refuses %p", (value) => {
    expect(() => parseCustomOAuthAccountUrl(value)).toThrow(
      "CUSTOM_OAUTH_ACCOUNT_URL must be an absolute http or https URL.",
    );
  });
});

describe("assertCustomOAuthEnv", () => {
  beforeEach(() => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "");
    vi.stubEnv("CUSTOM_OAUTH_ACCOUNT_URL", "");
  });

  it("accepts unset settings", () => {
    expect(() => assertCustomOAuthEnv()).not.toThrow();
  });

  it.each([
    ["CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "email"],
    ["CUSTOM_OAUTH_ACCOUNT_URL", "id.example.com/account"],
  ])("refuses an invalid %s", (key, value) => {
    vi.stubEnv(key, value);
    expect(() => assertCustomOAuthEnv()).toThrow(key);
  });
});
