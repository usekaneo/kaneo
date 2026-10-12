import {
  type DeviceCodeResponse,
  DeviceCodeRequestError,
  type DeviceTokenPoll,
  pollDeviceTokenOnce,
  requestDeviceCode,
} from "@kaneo/mcp/device-flow";
import { Context, Effect, Layer } from "effect";
import {
  DeviceClientRejected,
  ServerUnreachable,
  UnexpectedResponse,
} from "../errors/errors.js";
import { sanitizeText } from "../render/sanitize.js";

export const DEVICE_CLIENT_ID = "kaneo-cli";

export type DeviceAuthShape = {
  readonly requestCode: (
    apiUrl: string,
  ) => Effect.Effect<
    DeviceCodeResponse,
    DeviceClientRejected | ServerUnreachable | UnexpectedResponse
  >;
  readonly poll: (
    apiUrl: string,
    deviceCode: string,
  ) => Effect.Effect<DeviceTokenPoll, ServerUnreachable | UnexpectedResponse>;
};

export class DeviceAuth extends Context.Service<DeviceAuth, DeviceAuthShape>()(
  "kaneo/DeviceAuth",
) {}

export function toDeviceFailure(apiUrl: string, endpoint: string) {
  return (cause: unknown) => {
    if (
      cause instanceof DeviceCodeRequestError &&
      cause.error === "invalid_client"
    ) {
      return new DeviceClientRejected({ apiUrl, clientId: DEVICE_CLIENT_ID });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return message.startsWith("device/")
      ? new UnexpectedResponse({ endpoint, detail: message })
      : new ServerUnreachable({ apiUrl, reason: message });
  };
}

export function sanitizeDeviceCode(
  code: DeviceCodeResponse,
): DeviceCodeResponse {
  return {
    ...code,
    user_code: sanitizeText(code.user_code),
    verification_uri: sanitizeText(code.verification_uri),
    ...(code.verification_uri_complete === undefined
      ? {}
      : {
          verification_uri_complete: sanitizeText(
            code.verification_uri_complete,
          ),
        }),
  };
}

export const DeviceAuthLive = Layer.succeed(DeviceAuth, {
  requestCode: (apiUrl) =>
    Effect.tryPromise({
      try: () => requestDeviceCode(apiUrl, DEVICE_CLIENT_ID),
      catch: toDeviceFailure(apiUrl, "POST /api/auth/device/code"),
    }).pipe(Effect.map(sanitizeDeviceCode)),
  poll: (apiUrl, deviceCode) =>
    Effect.tryPromise({
      try: () => pollDeviceTokenOnce(apiUrl, DEVICE_CLIENT_ID, deviceCode),
      catch: (cause) => {
        const failure = toDeviceFailure(
          apiUrl,
          "POST /api/auth/device/token",
        )(cause);
        return failure._tag === "DeviceClientRejected"
          ? new UnexpectedResponse({
              endpoint: "POST /api/auth/device/token",
              detail: String(cause),
            })
          : failure;
      },
    }),
});
