import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_STORED_SETTINGS,
  resolveInstanceSettings,
} from "./resolve-instance-settings";

describe("resolveInstanceSettings", () => {
  it("keeps stored values when no variable forces them", () => {
    const stored = {
      ...DEFAULT_STORED_SETTINGS,
      instanceName: "  Acme  ",
      registrationEnabled: false,
    };
    expect(
      resolveInstanceSettings(stored, {
        DISABLE_REGISTRATION: "false",
        DISABLE_WORKSPACE_CREATION: "",
      }),
    ).toMatchObject({
      instanceName: "Acme",
      registrationEnabled: false,
      workspaceCreationRestricted: false,
      lockedByEnv: [],
    });
  });

  it("lets only `true` lock a setting", () => {
    const resolved = resolveInstanceSettings(DEFAULT_STORED_SETTINGS, {
      DISABLE_REGISTRATION: "true",
      DISABLE_PASSWORD_REGISTRATION: "true",
      DISABLE_WORKSPACE_CREATION: "true",
    });
    expect(resolved).toMatchObject({
      instanceName: "Kaneo",
      registrationEnabled: false,
      passwordRegistrationEnabled: false,
      workspaceCreationRestricted: true,
      lockedByEnv: [
        "registrationEnabled",
        "passwordRegistrationEnabled",
        "workspaceCreationRestricted",
      ],
    });
  });
});
