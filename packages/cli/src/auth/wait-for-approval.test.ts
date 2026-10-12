import type {
  DeviceCodeResponse,
  DeviceTokenPoll,
} from "@kaneo/mcp/device-flow";
import { type Duration, Effect, Fiber, Layer, Result } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vite-plus/test";
import { DeviceAuth } from "../services/device-auth.js";
import {
  formatUserCode,
  waitForApproval,
  webUrlFromVerificationUri,
} from "./wait-for-approval.js";

const code: DeviceCodeResponse = {
  device_code: "device",
  user_code: "ABCDEFGH",
  verification_uri: "https://app.kaneo.test/device",
  interval: 5,
  expires_in: 60,
};

function scripted(results: ReadonlyArray<DeviceTokenPoll>) {
  const polls: number[] = [];
  let index = 0;
  const layer = Layer.succeed(DeviceAuth, {
    requestCode: () => Effect.succeed(code),
    poll: () =>
      Effect.gen(function* () {
        polls.push(yield* Effect.clockWith((clock) => clock.currentTimeMillis));
        const result = results[Math.min(index, results.length - 1)] ?? {
          status: "pending",
        };
        index += 1;
        return result;
      }),
  });
  return { layer, polls };
}

const run = (layer: Layer.Layer<DeviceAuth>, advance: Duration.Input) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        Effect.result(waitForApproval("https://api.test", code)),
      );
      yield* TestClock.adjust(advance);
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(Layer.merge(layer, TestClock.layer()))),
  );

describe("waitForApproval", () => {
  it("polls at the server interval and slows down when asked", async () => {
    const device = scripted([
      { status: "pending" },
      { status: "slow_down" },
      { status: "pending" },
      { status: "approved", accessToken: "token" },
    ]);
    const result = await run(device.layer, "60 seconds");
    expect(result).toEqual(Result.succeed("token"));
    expect(device.polls).toEqual([0, 5_000, 15_000, 25_000]);
  });

  it("stops when the request is denied", async () => {
    const result = await run(
      scripted([{ status: "denied" }]).layer,
      "1 second",
    );
    expect(Result.isFailure(result) && result.failure._tag).toBe(
      "DeviceLoginDenied",
    );
  });

  it("gives up when the code expires", async () => {
    const result = await run(
      scripted([{ status: "pending" }]).layer,
      "61 seconds",
    );
    expect(Result.isFailure(result) && result.failure._tag).toBe(
      "DeviceLoginExpired",
    );
  });
});

describe("formatUserCode", () => {
  it("splits eight character codes", () => {
    expect(formatUserCode("abcdefgh")).toBe("ABCD-EFGH");
    expect(formatUserCode("ABCD-EFGH")).toBe("ABCD-EFGH");
    expect(formatUserCode("XYZ")).toBe("XYZ");
  });
});

describe("webUrlFromVerificationUri", () => {
  it("strips the device path", () => {
    expect(webUrlFromVerificationUri("https://app.kaneo.test/device")).toBe(
      "https://app.kaneo.test",
    );
    expect(webUrlFromVerificationUri("https://x.test/kaneo/device/")).toBe(
      "https://x.test/kaneo",
    );
    expect(webUrlFromVerificationUri("nope")).toBeUndefined();
  });
});
