/**
 * Sending under a provider tenant, offline: the transport names the tenant only
 * when asked, the dispatch asks the app only for mail that may be tenanted, and
 * a refusal because the tenant is paused comes back typed and is reported.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import type {
  SendEmailCommand,
  SendEmailCommandOutput,
} from "@aws-sdk/client-sesv2";
import { sendViaSes, SesEmailError, SesTenantPausedError } from "../ses";
import type { SesSendClient } from "../ses";
import { isTenantPausedFailure } from "../ses-tenant-paused";
import { sendMagicLinkEmail, sendRawEmail, setSesTenantHooks } from "../index";
import type { SesTenantHooks } from "../index";
import { createSendRateLimiter } from "../send-rate";
import { sendingAs } from "./brands";

const sdkSend = vi.hoisted(() => vi.fn());

vi.mock("@kaneo/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@kaneo/logger")>();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return { ...actual, createLogger: () => logger };
});

vi.mock("@aws-sdk/client-sesv2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-sesv2")>();
  return {
    ...actual,
    SESv2Client: class {
      send = sdkSend;
    },
  };
});

const ENV = {
  EMAIL_SES_ACCESS_KEY_ID: "AKIAEXAMPLE",
  EMAIL_SES_SECRET_ACCESS_KEY: "secret",
  EMAIL_SES_REGION: "eu-west-2",
  EMAIL_SES_CONFIGURATION_SET: "quackback",
  EMAIL_FROM: "Quackback <noreply@platform.test>",
};

function sesError(name: string, message: string, status = 400) {
  return Object.assign(new Error(message), {
    name,
    $metadata: { httpStatusCode: status },
  });
}

function clientRecording() {
  const commands: SendEmailCommand[] = [];
  const client: SesSendClient = {
    send: async (command) => {
      commands.push(command);
      return {
        MessageId: "id-1",
        $metadata: { httpStatusCode: 200 },
      } as SendEmailCommandOutput;
    },
  };
  return { client, commands };
}

const deps = (client: SesSendClient) => ({
  client,
  region: "eu-west-2",
  configurationSet: "quackback",
  limiter: createSendRateLimiter(1000),
});

describe("sendViaSes with a tenant", () => {
  it("names the tenant beside the configuration set when one is given", async () => {
    const { client, commands } = clientRecording();
    await sendViaSes(
      {
        from: "a@x.test",
        to: "b@y.test",
        subject: "s",
        text: "t",
        tenantName: "ws-abc",
      },
      deps(client),
    );
    expect(commands[0].input.TenantName).toBe("ws-abc");
    expect(commands[0].input.ConfigurationSetName).toBe("quackback");
  });

  it("names no tenant when none is given", async () => {
    const { client, commands } = clientRecording();
    await sendViaSes(
      { from: "a@x.test", to: "b@y.test", subject: "s", text: "t" },
      deps(client),
    );
    expect(commands[0].input).not.toHaveProperty("TenantName");
  });

  it("types a paused tenant refusal, permanent, with the reason kept", async () => {
    const client: SesSendClient = {
      send: async () => {
        throw sesError(
          "SendingPausedException",
          "Sending is paused for tenant ws-abc.",
        );
      },
    };
    const error = await sendViaSes(
      {
        from: "a@x.test",
        to: "b@y.test",
        subject: "s",
        text: "t",
        tenantName: "ws-abc",
      },
      deps(client),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SesTenantPausedError);
    expect(error).toBeInstanceOf(SesEmailError);
    const paused = error as SesTenantPausedError;
    expect(paused.tenantName).toBe("ws-abc");
    expect(paused.retryable).toBe(false);
    expect(paused.detail).toBe("Sending is paused for tenant ws-abc.");
  });

  it("leaves an account-wide pause untyped when the send named no tenant", async () => {
    const client: SesSendClient = {
      send: async () => {
        throw sesError(
          "SendingPausedException",
          "Sending is paused for tenant ws-abc.",
        );
      },
    };
    const error = await sendViaSes(
      { from: "a@x.test", to: "b@y.test", subject: "s", text: "t" },
      deps(client),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SesEmailError);
    expect(error).not.toBeInstanceOf(SesTenantPausedError);
  });
});

describe("isTenantPausedFailure", () => {
  const tenantName = "ws-abc";
  it("reads the pause exception that names the tenant", () => {
    const message = "Tenant ws-abc sending paused";
    expect(
      isTenantPausedFailure({
        tenantName,
        code: "SendingPausedException",
        message,
      }),
    ).toBe(true);
  });
  it("reads a generic rejection that says the tenant is disabled", () => {
    const message = "The tenant ws-abc is disabled for sending.";
    expect(
      isTenantPausedFailure({ tenantName, code: "MessageRejected", message }),
    ).toBe(true);
  });
  it("does not read a pause that never mentions a tenant (the whole account)", () => {
    const message = "Sending paused for this account.";
    expect(
      isTenantPausedFailure({
        tenantName,
        code: "SendingPausedException",
        message,
      }),
    ).toBe(false);
  });
  it("does not read a missing association as a pause", () => {
    const message = "Identity x.test is not associated with tenant ws-abc.";
    expect(
      isTenantPausedFailure({
        tenantName,
        code: "BadRequestException",
        message,
      }),
    ).toBe(false);
  });
  it("never reads a pause for a send with no tenant", () => {
    const message = "Tenant ws-abc sending paused";
    expect(
      isTenantPausedFailure({
        tenantName: undefined,
        code: "SendingPausedException",
        message,
      }),
    ).toBe(false);
  });
});

describe("dispatch asks the app for a tenant", () => {
  const saved: Record<string, string | undefined> = {};
  const asked: Array<{ emailType: string; from: string }> = [];
  const paused: Array<[string, string]> = [];
  let tenant: string | null = "ws-abc";

  const hooks: SesTenantHooks = {
    tenantFor: async (ctx) => {
      asked.push(ctx);
      return tenant;
    },
    onTenantPaused: async (name, detail) => {
      paused.push([name, detail]);
    },
  };

  beforeEach(() => {
    for (const [key, value] of Object.entries(ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
    asked.length = 0;
    paused.length = 0;
    tenant = "ws-abc";
    sdkSend.mockReset();
    sdkSend.mockResolvedValue({
      MessageId: "id-1",
      $metadata: { httpStatusCode: 200 },
    });
    setSesTenantHooks(hooks);
  });

  afterEach(() => {
    setSesTenantHooks(null);
    for (const key of Object.keys(ENV)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const raw = () =>
    sendRawEmail({
      from: sendingAs("Support <support@acme.test>"),
      to: "customer@example.test",
      subject: "Re: hi",
      html: "<p>hi</p>",
    });

  it("sends workspace mail under the tenant the app names, asked with the From", async () => {
    await raw();
    expect(asked).toEqual([
      { emailType: "RawEmail", from: "Support <support@acme.test>" },
    ]);
    expect(
      (sdkSend.mock.calls[0][0] as SendEmailCommand).input.TenantName,
    ).toBe("ws-abc");
  });

  it("sends untenanted when the app names none", async () => {
    tenant = null;
    await raw();
    expect(
      (sdkSend.mock.calls[0][0] as SendEmailCommand).input,
    ).not.toHaveProperty("TenantName");
  });

  it("never asks about sign-in mail, which always sends untenanted", async () => {
    await sendMagicLinkEmail({
      to: "person@example.test" as never,
      signInUrl: "https://app.test/s",
      code: "123456",
    });
    expect(asked).toEqual([]);
    expect(
      (sdkSend.mock.calls[0][0] as SendEmailCommand).input,
    ).not.toHaveProperty("TenantName");
  });

  it("sends untenanted when the lookup throws", async () => {
    hooks.tenantFor = async () => {
      throw new Error("db down");
    };
    try {
      await raw();
      expect(
        (sdkSend.mock.calls[0][0] as SendEmailCommand).input,
      ).not.toHaveProperty("TenantName");
    } finally {
      hooks.tenantFor = async (ctx) => {
        asked.push(ctx);
        return tenant;
      };
    }
  });

  it("reports a paused tenant to the app and still fails the send", async () => {
    sdkSend.mockRejectedValue(
      sesError("SendingPausedException", "Tenant ws-abc is paused."),
    );
    await expect(raw()).rejects.toBeInstanceOf(SesTenantPausedError);
    expect(paused).toEqual([["ws-abc", "Tenant ws-abc is paused."]]);
  });

  it("reports nothing for a failure that is not a pause", async () => {
    sdkSend.mockRejectedValue(
      sesError("MessageRejected", "Email address is not verified."),
    );
    await expect(raw()).rejects.toBeInstanceOf(SesEmailError);
    expect(paused).toEqual([]);
  });
});
