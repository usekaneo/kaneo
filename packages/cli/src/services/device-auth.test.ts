import { DeviceCodeRequestError } from "@kaneo/mcp/device-flow";
import { describe, expect, it } from "vite-plus/test";
import { sanitizeDeviceCode, toDeviceFailure } from "./device-auth.js";

const toFailure = toDeviceFailure(
  "https://cloud.kaneo.app",
  "POST /api/auth/device/code",
);

describe("toDeviceFailure", () => {
  it("explains a server that does not allow the CLI client", () => {
    const failure = toFailure(
      new DeviceCodeRequestError(400, {
        error: "invalid_client",
        error_description: "Invalid client ID",
      }),
    );
    expect(failure).toMatchObject({
      _tag: "DeviceClientRejected",
      clientId: "kaneo-cli",
    });
  });

  it("reports other device errors as unexpected responses", () => {
    expect(
      toFailure(new DeviceCodeRequestError(500, { error: "server_error" }))
        ._tag,
    ).toBe("UnexpectedResponse");
  });

  it("reports network failures as an unreachable server", () => {
    expect(toFailure(new TypeError("fetch failed"))._tag).toBe(
      "ServerUnreachable",
    );
  });
});

describe("sanitizeDeviceCode", () => {
  it("strips escape sequences from server supplied fields", () => {
    const code = sanitizeDeviceCode({
      device_code: "device",
      user_code: "ABCD\u001b[2JEFGH",
      verification_uri: "https://x.test/device\u0007",
      verification_uri_complete: "https://x.test/device?c=1\u001b]8;;",
      interval: 5,
      expires_in: 600,
    });
    expect(code.user_code).toBe("ABCD[2JEFGH");
    expect(code.verification_uri).toBe("https://x.test/device");
    expect(code.verification_uri_complete).toBe(
      "https://x.test/device?c=1]8;;",
    );
  });
});
