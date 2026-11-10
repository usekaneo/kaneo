import { describe, it, expect, vi } from "vite-plus/test";
import { Readable } from "node:stream";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { sesClientConfig } from "../ses";

/**
 * The SDK client this transport builds, against a fake wire.
 *
 * A real `SESv2Client` with only its HTTP handler replaced, so the SDK's own
 * retry middleware runs exactly as it does in production and the handler counts
 * how many requests actually reach "SES".
 */

type FakeResponse = { status: number; errorType?: string; body: unknown };

function wire(responses: FakeResponse[]) {
  const handle = vi.fn(async () => {
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    return {
      response: {
        statusCode: next.status,
        reason: undefined,
        headers: {
          "content-type": "application/json",
          ...(next.errorType ? { "x-amzn-errortype": next.errorType } : {}),
        },
        body: Readable.from([Buffer.from(JSON.stringify(next.body))]),
      },
    };
  });
  return { handle, requestHandler: { handle } };
}

function client(requestHandler: unknown) {
  return new SESv2Client({
    ...sesClientConfig("us-east-1", {
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
    }),
    requestHandler: requestHandler as never,
  });
}

const command = () =>
  new SendEmailCommand({
    FromEmailAddress: "hi@platform.test",
    Destination: { ToAddresses: ["a@b.test"] },
    Content: {
      Simple: { Subject: { Data: "s" }, Body: { Text: { Data: "t" } } },
    },
  });

const THROTTLED: FakeResponse = {
  status: 429,
  errorType: "TooManyRequestsException",
  body: { message: "Maximum sending rate exceeded." },
};

describe("the SES client retry policy", () => {
  it("does not resend a throttled request on its own", async () => {
    // A resend here would be a second SES call inside one send-rate slot, made
    // while SES is already saying the account is over its rate.
    const { handle, requestHandler } = wire([
      THROTTLED,
      { status: 200, body: { MessageId: "m-1" } },
    ]);
    await expect(client(requestHandler).send(command())).rejects.toMatchObject({
      name: "TooManyRequestsException",
    });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("still resends a transient failure, so a request-path send survives a blip", async () => {
    const { handle, requestHandler } = wire([
      { status: 503, body: { message: "Service Unavailable" } },
      { status: 200, body: { MessageId: "m-1" } },
    ]);
    await expect(client(requestHandler).send(command())).resolves.toMatchObject(
      {
        MessageId: "m-1",
      },
    );
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("gives up on a transient failure after a bounded number of tries", async () => {
    const { handle, requestHandler } = wire([
      { status: 503, body: { message: "unavailable" } },
    ]);
    await expect(client(requestHandler).send(command())).rejects.toBeDefined();
    expect(handle).toHaveBeenCalledTimes(3);
  });
});
