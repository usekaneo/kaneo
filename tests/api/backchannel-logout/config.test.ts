import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  assertBackchannelLogoutEnv,
  resolveBackchannelLogoutConfig,
} from "../../../apps/api/src/backchannel-logout/config";

const DISCOVERY_URL =
  "https://idp.example.com/realms/kaneo/.well-known/openid-configuration";
const ENABLED = {
  CUSTOM_OAUTH_BACKCHANNEL_LOGOUT: "true",
  CUSTOM_OAUTH_DISCOVERY_URL: DISCOVERY_URL,
  CUSTOM_OAUTH_CLIENT_ID: "kaneo",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("back-channel logout configuration", () => {
  it.each([undefined, "", "false", "TRUE", "1"])(
    "stays off for %p without checking the provider settings",
    (value) => {
      expect(
        resolveBackchannelLogoutConfig({
          CUSTOM_OAUTH_BACKCHANNEL_LOGOUT: value,
        }),
      ).toEqual({ enabled: false });
    },
  );

  it.each([
    undefined,
    "",
    "/realms/kaneo/.well-known/openid-configuration",
    "ftp://idp.example.com/.well-known/openid-configuration",
  ])("refuses to start without a usable discovery URL (%p)", (url) => {
    expect(() =>
      resolveBackchannelLogoutConfig({
        ...ENABLED,
        CUSTOM_OAUTH_DISCOVERY_URL: url,
      }),
    ).toThrow(/CUSTOM_OAUTH_DISCOVERY_URL/);
  });

  it.each([undefined, "", "  "])(
    "refuses to start without a client ID (%p)",
    (clientId) => {
      expect(() =>
        resolveBackchannelLogoutConfig({
          ...ENABLED,
          CUSTOM_OAUTH_CLIENT_ID: clientId,
        }),
      ).toThrow(/CUSTOM_OAUTH_CLIENT_ID/);
    },
  );

  it("returns the trimmed discovery URL and client ID", () => {
    expect(
      resolveBackchannelLogoutConfig({
        ...ENABLED,
        CUSTOM_OAUTH_DISCOVERY_URL: ` ${DISCOVERY_URL} `,
        CUSTOM_OAUTH_CLIENT_ID: " kaneo ",
      }),
    ).toEqual({
      enabled: true,
      discoveryUrl: DISCOVERY_URL,
      clientId: "kaneo",
    });
  });

  it("warns at startup when sign-ins do not request the openid scope", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    assertBackchannelLogoutEnv(ENABLED);
    assertBackchannelLogoutEnv({
      ...ENABLED,
      CUSTOM_OAUTH_SCOPES: "profile,email",
    });
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockClear();
    assertBackchannelLogoutEnv({
      ...ENABLED,
      CUSTOM_OAUTH_SCOPES: "profile, openid ,email",
    });
    assertBackchannelLogoutEnv({
      ...ENABLED,
      CUSTOM_OAUTH_SCOPES: "openid profile email",
    });
    assertBackchannelLogoutEnv({ CUSTOM_OAUTH_SCOPES: "profile,email" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("stops the startup check on invalid settings", () => {
    expect(() =>
      assertBackchannelLogoutEnv({
        ...ENABLED,
        CUSTOM_OAUTH_DISCOVERY_URL: "",
      }),
    ).toThrow(/CUSTOM_OAUTH_DISCOVERY_URL/);
  });
});
