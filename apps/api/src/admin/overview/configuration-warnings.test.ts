import { describe, expect, it } from "vite-plus/test";
import { configurationWarnings } from "./configuration-warnings";

type Services = Parameters<typeof configurationWarnings>[0];

const services = (storage: Partial<Services["storage"]>) =>
  ({
    email: { configured: true, status: "ok" },
    redis: { status: "not_configured" },
    storage: { configured: true, status: "ok", ...storage },
  }) as unknown as Services;

describe("configurationWarnings", () => {
  it("doesn't warn about upload-only storage that answers 403", () => {
    expect(
      configurationWarnings(
        services({ status: "warning", errorCode: "HTTP_403" }),
        false,
        2,
      ),
    ).toEqual([]);
  });

  it("warns when storage is unreachable", () => {
    expect(
      configurationWarnings(
        services({ status: "down", errorCode: "ECONNREFUSED" }),
        false,
        2,
      ),
    ).toEqual(["storage_unreachable"]);
  });
});
