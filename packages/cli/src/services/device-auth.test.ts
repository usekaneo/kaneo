import { DeviceCodeRequestError } from "@kaneo/mcp/device-flow";
import { describe, expect, it } from "vite-plus/test";
import { toDeviceFailure } from "./device-auth.js";

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
