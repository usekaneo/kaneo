import type { DeviceCodeResponse } from "@kaneo/mcp/device-flow";
import { Duration, Effect, Option, Ref, Schedule } from "effect";
import { DeviceLoginDenied, DeviceLoginExpired } from "../errors/errors.js";
import { DeviceAuth } from "../services/device-auth.js";

const SLOW_DOWN_SECONDS = 5;

export const waitForApproval = Effect.fn("auth.waitForApproval")(function* (
  apiUrl: string,
  code: DeviceCodeResponse,
) {
  const device = yield* DeviceAuth;
  const interval = yield* Ref.make(Math.max(1, code.interval));

  const poll = device.poll(apiUrl, code.device_code).pipe(
    Effect.retry({
      schedule: Schedule.spaced("2 seconds"),
      times: 3,
      while: (error) => error._tag === "ServerUnreachable",
    }),
    Effect.tap((result) =>
      result.status === "slow_down"
        ? Ref.update(interval, (seconds) => seconds + SLOW_DOWN_SECONDS)
        : Effect.void,
    ),
  );

  const pacing = Schedule.passthrough(
    Schedule.forever.pipe(
      Schedule.addDelay(() => Effect.map(Ref.get(interval), Duration.seconds)),
    ),
  );

  const outcome = yield* poll.pipe(
    Effect.repeat({
      schedule: pacing,
      while: (result) =>
        result.status === "pending" || result.status === "slow_down",
    }),
    Effect.timeoutOption(Duration.seconds(code.expires_in)),
  );

  if (Option.isNone(outcome)) return yield* new DeviceLoginExpired();
  const result = outcome.value;
  if (result.status === "approved") return result.accessToken;
  if (result.status === "denied") return yield* new DeviceLoginDenied();
  return yield* new DeviceLoginExpired();
});

export function formatUserCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function webUrlFromVerificationUri(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    const path = url.pathname.replace(/\/device\/?$/, "").replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return undefined;
  }
}
