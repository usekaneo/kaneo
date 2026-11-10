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
import {
  addressDomain,
  formatAddress,
  isSesEmailConfigured,
  parseAddress,
  safeDetail,
  sendViaSes,
  SesEmailError,
  sesConfigurationSet,
  sesMaxSendRate,
  sesRegion,
  sesSendRateLimiter,
  stripPlatformControlledHeaders,
  DEFAULT_SES_MAX_SEND_RATE,
} from "../ses";
import { SendRateQueueFullError } from "../send-rate";
import type { SendRateLimiter } from "../send-rate";
import type { SesSendClient } from "../ses";
import {
  getEmailProvider,
  sendChangelogPublishedEmail,
  sendConversationMessageEmail,
  sendNewCommentEmail,
  sendPostMentionEmail,
  sendRawEmail,
  sendStatusChangeEmail,
} from "../index";
import { sendingAs } from "./brands";

/**
 * The SES rung, offline. Every send here goes through an injected client or a
 * mocked SDK client class; nothing in this file may touch the network.
 *
 * Two properties carry most of the weight. Exactly one provider is selected
 * (two configured is refused rather than ranked), and the selection is
 * whole-process with no per-send exception: SES verifies an identity from a DNS
 * record its owner publishes, so a workspace sending as its own branded domain
 * uses this rung like everything else.
 */

/** The `send` every env-driven test observes, shared by the mocked SDK client. */
const sdkSend = vi.hoisted(() => vi.fn());

/** The `warn` the console rung is asserted to reach. */
const logWarn = vi.hoisted(() => vi.fn());

/** The `error` a send failure that will not be retried is asserted to reach. */
const logError = vi.hoisted(() => vi.fn());

vi.mock("@kaneo/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@kaneo/logger")>();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: logWarn,
    error: logError,
    child: () => logger,
  };
  return { ...actual, createLogger: () => logger };
});

vi.mock("@aws-sdk/client-sesv2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-sesv2")>();
  return {
    ...actual,
    // Real commands, fake transport: the command still builds the wire input so
    // assertions read the same shape the SDK would have serialized.
    SESv2Client: class {
      send = sdkSend;
    },
  };
});

const ENV_KEYS = [
  "EMAIL_SES_ACCESS_KEY_ID",
  "EMAIL_SES_SECRET_ACCESS_KEY",
  "EMAIL_SES_REGION",
  "EMAIL_SES_CONFIGURATION_SET",
  "EMAIL_SMTP_HOST",
  "EMAIL_RESEND_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_INBOUND_PROVIDER",
  "EMAIL_FROM",
  "EMAIL_SES_MAX_SEND_RATE",
] as const;

function withCleanEnv() {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] !== undefined) process.env[key] = saved[key];
      else delete process.env[key];
    }
  });
}

/**
 * A client that records its commands and answers with an SES acceptance.
 *
 * `messageId` is a required argument rather than a defaulted one so a test can
 * ask for the response SES never sends: passing `undefined` to a defaulted
 * parameter would silently hand back the happy id instead.
 */
function acceptingClient(messageId: string | undefined) {
  const commands: SendEmailCommand[] = [];
  const send = vi.fn(async (command: SendEmailCommand) => {
    commands.push(command);
    return {
      MessageId: messageId,
      $metadata: { httpStatusCode: 200 },
    } as SendEmailCommandOutput;
  });
  return { client: { send } as unknown as SesSendClient, commands, send };
}

/** A client that refuses every command with the given error. */
function refusingClient(error: unknown) {
  const send = vi.fn(async () => {
    throw error;
  });
  return { client: { send } as unknown as SesSendClient, send };
}

/** An SDK-shaped service exception. */
function sesError(
  name: string,
  message: string,
  httpStatusCode: number | null,
  extra: Record<string, unknown> = {},
) {
  return Object.assign(new Error(message), {
    name,
    $metadata: httpStatusCode === null ? {} : { httpStatusCode },
    ...extra,
  });
}

/** A fake client and the region it stands for, which travel together. */
const DEPS = (client: SesSendClient, configurationSet?: string) => ({
  client,
  region: "us-east-1",
  configurationSet,
});

/** The host the verified region stamps on an id it assigned. */
const HOST = "email.amazonses.com";

/** The last command's built input, which is what the SDK would serialize. */
function sentInput(commands: SendEmailCommand[]) {
  return commands[commands.length - 1].input;
}

/** The `Simple` content of the last command. */
function sentSimple(commands: SendEmailCommand[]) {
  const content = sentInput(commands).Content;
  return content?.Simple;
}

beforeEach(() => {
  logWarn.mockClear();
  logError.mockClear();
  sdkSend.mockReset();
  sdkSend.mockResolvedValue({
    MessageId: "ses-assigned-1",
    $metadata: { httpStatusCode: 200 },
  } as SendEmailCommandOutput);
});

/**
 * The parse half only. It reaches the wire through {@link formatAddress}, which
 * is what the tests below hold to the header's rules; on its own this splits a
 * value into data and deliberately drops the quoting that made it one.
 */
describe("parseAddress", () => {
  it("splits a display-name address into its parts", () => {
    expect(parseAddress("Support <support@acme.test>")).toEqual({
      address: "support@acme.test",
      name: "Support",
    });
    expect(parseAddress('"Doe, Jane" <jane@acme.test>')).toEqual({
      address: "jane@acme.test",
      name: "Doe, Jane",
    });
  });

  it("passes a bare address through as a string", () => {
    expect(parseAddress("  support@acme.test ")).toBe("support@acme.test");
  });
});

/**
 * What actually goes in the `From`. `EMAIL_FROM` is operator-typed and nothing
 * validates it on the way in, so the two forms that are legal-looking and wrong
 * on the wire have to be corrected here or the send is rejected.
 */
describe("formatAddress", () => {
  it("quotes a display name that would otherwise read as a second address", () => {
    // The header is a list. Unquoted, this is two addresses and a rejection.
    expect(formatAddress("Acme, Inc <noreply@acme.test>")).toBe(
      '"Acme, Inc" <noreply@acme.test>',
    );
  });

  it("keeps an already-quoted name quoted rather than unwrapping it", () => {
    expect(formatAddress('"Doe, Jane" <jane@acme.test>')).toBe(
      '"Doe, Jane" <jane@acme.test>',
    );
  });

  it("encodes a non-ASCII display name as an RFC 2047 word", () => {
    // An address header is not a text field: it cannot carry UTF-8 the way a
    // subject can, so the name has to arrive already encoded.
    expect(formatAddress("Café Support <hi@acme.test>")).toBe(
      `=?UTF-8?B?${Buffer.from("Café Support", "utf8").toString("base64")}?= <hi@acme.test>`,
    );
  });

  it("leaves an ordinary name and a bare address alone", () => {
    expect(formatAddress("Support <support@acme.test>")).toBe(
      "Support <support@acme.test>",
    );
    expect(formatAddress("  support@acme.test ")).toBe("support@acme.test");
  });
});

describe("addressDomain", () => {
  it("reads the domain out of either address form, lower-cased", () => {
    expect(addressDomain("Support <Support@Acme.TEST>")).toBe("acme.test");
    expect(addressDomain("support@acme.test")).toBe("acme.test");
    expect(addressDomain("not-an-address")).toBeNull();
    expect(addressDomain(undefined)).toBeNull();
  });
});

describe("provider ladder", () => {
  withCleanEnv();

  it("selects console when nothing is configured", () => {
    expect(getEmailProvider()).toBe("console");
  });

  it("keeps SMTP for a self-hoster who named a mail server", () => {
    // The compatibility promise. A self-hoster has no SES credentials for SES
    // to overtake them with, so naming a host is still the whole decision.
    process.env.EMAIL_SMTP_HOST = "smtp.acme.test";
    expect(getEmailProvider()).toBe("smtp");
  });

  it("refuses ses and smtp together rather than ranking them", () => {
    process.env.EMAIL_SMTP_HOST = "smtp.acme.test";
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    expect(() => getEmailProvider()).toThrow(/EMAIL_SMTP_HOST/);
  });

  it("keeps SMTP when only half the SES credential is set", () => {
    // Half a credential is a misconfiguration, not a partial capability:
    // neither the key id nor the secret authorizes anything alone.
    process.env.EMAIL_SMTP_HOST = "smtp.acme.test";
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    expect(getEmailProvider()).toBe("smtp");
    expect(isSesEmailConfigured()).toBe(false);
    delete process.env.EMAIL_SES_ACCESS_KEY_ID;
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    expect(getEmailProvider()).toBe("smtp");
    expect(isSesEmailConfigured()).toBe(false);
  });

  it("sends through Resend from a lone Resend key", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(getEmailProvider()).toBe("resend");
  });

  it("keeps SES sending when the Resend key is declared inbound-only", () => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_RESEND_API_KEY = "re_test";
    process.env.EMAIL_INBOUND_PROVIDER = "resend";
    expect(getEmailProvider()).toBe("ses");
  });
});

describe("ses configuration", () => {
  withCleanEnv();

  it("reports no region rather than guessing one, and leaves the configuration set unset", () => {
    // A verified identity belongs to one region, so a default is a guess about
    // where the operator did their DNS. A self-hoster has no configuration set
    // to name, so that one really is optional.
    expect(sesRegion()).toBeNull();
    expect(sesConfigurationSet()).toBeUndefined();
  });

  it("takes both from the environment when set", () => {
    process.env.EMAIL_SES_REGION = "eu-west-2";
    process.env.EMAIL_SES_CONFIGURATION_SET = "fleet-events";
    expect(sesRegion()).toBe("eu-west-2");
    expect(sesConfigurationSet()).toBe("fleet-events");
  });

  it("still selects the SES rung when only the region is missing", () => {
    // The rung answers "did this install ask for SES", and credentials are the
    // asking. Folding the region in here would drop such an install onto a mail
    // server it never named, or onto the console, which delivers nothing.
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    expect(isSesEmailConfigured()).toBe(true);
    expect(getEmailProvider()).toBe("ses");
  });
});

/**
 * A deploy can hold every credential and still be unable to send. Each of these
 * is refused before a request is built, permanently, naming the variable — the
 * alternative is a backoff spent on something no attempt can supply, and for
 * the region it is worse than that: it used to default, so a deploy that
 * verified its identity elsewhere connected successfully and had every send
 * rejected for an identity that exists.
 */
describe("configuration that cannot send", () => {
  withCleanEnv();

  beforeEach(() => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_FROM = "Support <support@platform.test>";
  });

  it("refuses a send with no region, permanently, and names the variable", async () => {
    await expect(
      sendRawEmail({
        from: sendingAs("a@platform.test"),
        to: "c@d.test",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({ name: "SesEmailError", retryable: false });
    await expect(
      sendRawEmail({
        from: sendingAs("a@platform.test"),
        to: "c@d.test",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).rejects.toThrow(/EMAIL_SES_REGION/);
    expect(sdkSend).not.toHaveBeenCalled();
  });

  it("refuses a send with no EMAIL_FROM, permanently", async () => {
    // The branded senders resolve EMAIL_FROM rather than passing their own, so
    // an unset one is a send that cannot happen however many times it is tried.
    process.env.EMAIL_SES_REGION = "us-east-1";
    delete process.env.EMAIL_FROM;
    await expect(
      sendStatusChangeEmail({
        to: "c@d.test",
        postTitle: "T",
        postUrl: "https://x.test/p/1",
        previousStatus: "open",
        newStatus: "closed",
        workspaceName: "W",
        unsubscribeUrl: "https://x.test/u",
      }),
    ).rejects.toMatchObject({ name: "EmailConfigError", retryable: false });
    expect(sdkSend).not.toHaveBeenCalled();
  });
});

describe("sendViaSes attachments", () => {
  it("carries real files on the Simple content Attachments list", async () => {
    const { client, commands } = acceptingClient("ses-assigned-1");
    const content = new TextEncoder().encode("%PDF-1.4 fake");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        html: "<p>hi</p>",
        attachments: [
          { filename: "invoice.pdf", contentType: "application/pdf", content },
        ],
      },
      DEPS(client),
    );

    expect(sentSimple(commands)?.Attachments).toEqual([
      {
        RawContent: content,
        FileName: "invoice.pdf",
        ContentType: "application/pdf",
        ContentDisposition: "ATTACHMENT",
      },
    ]);
  });

  it("omits the Attachments field entirely when there are none", async () => {
    const { client, commands } = acceptingClient("ses-assigned-1");
    await sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      DEPS(client),
    );
    expect(sentSimple(commands)).not.toHaveProperty("Attachments");
  });

  it("carries more than one attachment, in order", async () => {
    const { client, commands } = acceptingClient("ses-assigned-1");
    const a = new TextEncoder().encode("aaa");
    const b = new TextEncoder().encode("bbbbb");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        attachments: [
          { filename: "a.txt", contentType: "text/plain", content: a },
          { filename: "b.txt", contentType: "text/plain", content: b },
        ],
      },
      DEPS(client),
    );
    expect(sentSimple(commands)?.Attachments?.map((x) => x.FileName)).toEqual([
      "a.txt",
      "b.txt",
    ]);
  });
});

describe("sendViaSes", () => {
  it("builds the SES wire shape", async () => {
    const { client, commands } = acceptingClient("ses-assigned-1");
    const result = await sendViaSes(
      {
        from: "Support <hi@platform.test>",
        to: "a@b.test",
        subject: "Hello",
        html: "<p>hi</p>",
        text: "hi",
        replyTo: "reply@platform.test",
      },
      DEPS(client),
    );

    const input = sentInput(commands);
    // One RFC 5322 string, which is what the API takes. An ordinary display
    // name comes back out of the re-render exactly as it went in.
    expect(input.FromEmailAddress).toBe("Support <hi@platform.test>");
    expect(input.Destination).toEqual({ ToAddresses: ["a@b.test"] });
    expect(input.ReplyToAddresses).toEqual(["reply@platform.test"]);
    expect(sentSimple(commands)?.Subject).toEqual({
      Data: "Hello",
      Charset: "UTF-8",
    });
    expect(sentSimple(commands)?.Body).toEqual({
      Html: { Data: "<p>hi</p>", Charset: "UTF-8" },
      Text: { Data: "hi", Charset: "UTF-8" },
    });
    expect(result.messageId).toBe("ses-assigned-1");
  });

  it("applies a configuration set only when one is configured", async () => {
    const withSet = acceptingClient("ses-assigned-1");
    await sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      DEPS(withSet.client, "fleet-events"),
    );
    expect(sentInput(withSet.commands).ConfigurationSetName).toBe(
      "fleet-events",
    );

    const without = acceptingClient("ses-assigned-1");
    await sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      DEPS(without.client),
    );
    expect(sentInput(without.commands)).not.toHaveProperty(
      "ConfigurationSetName",
    );
  });

  it("carries threading headers and drops the platform-controlled ones", async () => {
    // The guard belongs with the constraint it enforces. A caller that assembles
    // its own headers and calls this directly must not be able to reach the API
    // with a platform-controlled one and take a hard rejection for it.
    const { client, commands } = acceptingClient("ses-assigned-1");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: {
          "Message-ID": "<ours@platform.test>",
          Date: "Mon, 1 Jan 2024 00:00:00 +0000",
          "In-Reply-To": "<parent@platform.test>",
        },
      },
      DEPS(client),
    );
    expect(sentSimple(commands)?.Headers).toEqual([
      { Name: "In-Reply-To", Value: "<parent@platform.test>" },
    ]);
  });

  it("omits the headers field entirely when the strip empties it", async () => {
    const { client, commands } = acceptingClient("ses-assigned-1");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: { "Message-ID": "<x@y>" },
      },
      DEPS(client),
    );
    expect(sentSimple(commands)).not.toHaveProperty("Headers");
  });
});

/**
 * The one place a regional host is composed at all. Why the completion has to
 * happen here is in `completeThreadingIds`; what matters to these cases is what
 * getting the host wrong costs, which is the recipient's client its grouping
 * and nothing else. Nothing on this path is stored, and nothing on this path
 * decides where a reply is routed.
 */
describe("completing the threading tokens that name an id this transport assigned", () => {
  it("gives a bare token the host of its region and leaves a hosted one untouched", async () => {
    const { client, commands } = acceptingClient("ses-assigned-2");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: {
          "In-Reply-To": "<0100018f-abc>",
          References: "<c.abc.n1@workspace-a.test> <0100018f-abc>",
        },
      },
      DEPS(client),
    );
    expect(sentSimple(commands)?.Headers).toEqual([
      { Name: "In-Reply-To", Value: `<0100018f-abc@${HOST}>` },
      {
        Name: "References",
        Value: `<c.abc.n1@workspace-a.test> <0100018f-abc@${HOST}>`,
      },
    ]);
  });

  it("composes the host of the region this client was built for", async () => {
    const { client, commands } = acceptingClient("ses-assigned-2");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: { "In-Reply-To": "<0100018f-abc>" },
      },
      { client, region: "eu-west-2" },
    );
    expect(sentSimple(commands)?.Headers).toEqual([
      { Name: "In-Reply-To", Value: "<0100018f-abc@eu-west-2.amazonses.com>" },
    ]);
  });

  it("touches no header but the two that carry ids", async () => {
    // A bare-looking value in some other header is somebody else's data. The
    // rewrite is scoped by header name, not by what a value happens to look
    // like.
    const { client, commands } = acceptingClient("ses-assigned-2");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: { "X-Quackback-Kind": "<reply>", "List-Id": "<announce>" },
      },
      DEPS(client),
    );
    expect(sentSimple(commands)?.Headers).toEqual([
      { Name: "X-Quackback-Kind", Value: "<reply>" },
      { Name: "List-Id", Value: "<announce>" },
    ]);
  });

  it("leaves a token alone that no header could have carried", async () => {
    // Completing a malformed token would turn something a client will ignore
    // into something that looks like a real id and still names nothing.
    const { client, commands } = acceptingClient("ses-assigned-2");
    await sendViaSes(
      {
        from: "hi@platform.test",
        to: "a@b.test",
        subject: "s",
        headers: { References: "<has space> <a@b@c>" },
      },
      DEPS(client),
    );
    expect(sentSimple(commands)?.Headers).toEqual([
      { Name: "References", Value: "<has space> <a@b@c>" },
    ]);
  });
});

/**
 * Acceptance is the assigned id, not the absence of an exception. SES answers a
 * successful send with exactly one field and it is the receipt; a response
 * without it is not a send this transport can report.
 */
describe("acceptance", () => {
  it("reports the assigned id exactly as the API gave it, host and all missing", async () => {
    // Bare is what the API answers, and bare is what comes back. Reconciling
    // that with the hosted token a reply quotes is the store's job, not this
    // one's — see the route-home suite in the app.
    const { client } = acceptingClient("0100018f-abc");
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).resolves.toEqual({ messageId: "0100018f-abc" });
  });

  it("reports the same id whatever region the client was built for", async () => {
    // The region reaches the outbound header and nothing else. A deploy in a
    // second region records exactly what a deploy in the first would, so a
    // region whose host we have never seen cannot cost a reply its route home.
    const { client } = acceptingClient("0100018f-abc");
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        { client, region: "eu-west-2" },
      ),
    ).resolves.toEqual({ messageId: "0100018f-abc" });
  });

  it("takes an id that already carries a host as it stands", async () => {
    // Defensive: a provider that starts answering with the full form is reported
    // in that form, unaltered.
    const { client } = acceptingClient(`0100018f-abc@${HOST}`);
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).resolves.toEqual({ messageId: `0100018f-abc@${HOST}` });
  });

  it("throws on a 2xx that carries no message id, and asks to be tried again", async () => {
    // Thrown, because returning an empty id would let it be recorded as the
    // outbound Message-ID and poison every later attempt to resolve a reply.
    // Retryable, because a real acceptance always carries an id, so a response
    // without one came from something between us and SES and is per attempt —
    // and a retry has something to gain: the id itself.
    const { client } = acceptingClient(undefined);
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).rejects.toMatchObject({ name: "SesEmailError", retryable: true });
  });

  it("refuses a blank message id the same way", async () => {
    const { client } = acceptingClient("   ");
    const error = await sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      DEPS(client),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SesEmailError);
    expect(error).toMatchObject({ retryable: true });
  });

  /**
   * The check is on the SHAPE of the id, not merely on its presence, because
   * this value is stored and later compared for equality: an id nothing could
   * ever match is as useless as no id at all, and a caller has no way to tell
   * the two apart after the fact.
   */
  it("refuses an id no header could carry and no row could be matched against", async () => {
    const unusable: Array<[string, string]> = [
      ["<>", "brackets with nothing inside them"],
      ["@email.amazonses.com", "a host with no id in front of it"],
      // The one that matters most to the store: it splits an id on its single
      // `@` to decide whether the provider assigned it. Two `@` make that
      // question unanswerable, and the answer it would guess at is what decides
      // whether a local part alone may match a row.
      ["a@b@email.amazonses.com", "more than one at-sign"],
      ["0100018f abc", "whitespace inside the id"],
      ["0100018f\u0001abc", "a control character"],
      ["0100018f-abcé", "a character outside US-ASCII"],
      ["0100018f<abc", "a bracket inside the id"],
    ];
    for (const [assigned, why] of unusable) {
      const { client } = acceptingClient(assigned);
      const error: unknown = await sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ).catch((e: unknown) => e);
      expect(error, why).toBeInstanceOf(SesEmailError);
      expect(error, why).toMatchObject({ retryable: true });
    }
  });
});

/**
 * A send that cannot succeed should not be attempted three times. The caller
 * retries everything by default (a hand-maintained transient-error allow-list
 * fails closed), so the transport is what declares the exceptions.
 */
describe("failure classification", () => {
  it("marks a 4xx rejection permanent — the usual cause is an identity we cannot send as", async () => {
    const { client } = refusingClient(
      sesError("MessageRejected", "Email address is not verified.", 400),
    );
    await expect(
      sendViaSes(
        { from: "Support <hi@not-ours.test>", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "MessageRejected",
      retryable: false,
    });
  });

  it("marks a 5xx, a timeout and a rate limit worth another attempt", async () => {
    for (const status of [500, 502, 408, 429]) {
      const { client } = refusingClient(
        sesError("InternalFailure", "upstream", status),
      );
      await expect(
        sendViaSes(
          { from: "hi@platform.test", to: "a@b.test", subject: "s" },
          DEPS(client),
        ),
      ).rejects.toMatchObject({ status, retryable: true });
    }
  });

  /**
   * The shape a real client throws when the connection never opens, captured
   * from an SESv2Client pointed at a closed port: a bare `Error` whose `name`
   * is the useless word "Error", the socket code on `code`, no HTTP status, and
   * no `$retryable` — the SDK sets that only on modeled service exceptions.
   */
  function transportError(code: string, message: string) {
    return Object.assign(new Error(message), { code });
  }

  it("keeps the socket code rather than the generic error name", async () => {
    // The name here carries nothing. The code is the whole signal, and it is
    // the vocabulary the app's own retry classifier is written against, so
    // taking `name` instead tells it the error is called "Error".
    const { client } = refusingClient(
      transportError("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:443"),
    );
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).rejects.toMatchObject({ status: null, code: "ECONNREFUSED" });
  });

  it("marks every transport failure worth another attempt", async () => {
    // A blip, not a verdict on the message. Nothing re-sends a conversation
    // email that this path drops, so classifying one of these as permanent
    // loses the mail outright while the thread still renders it as sent.
    for (const code of [
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ]) {
      const { client } = refusingClient(
        transportError(code, `socket failed: ${code}`),
      );
      await expect(
        sendViaSes(
          { from: "hi@platform.test", to: "a@b.test", subject: "s" },
          DEPS(client),
        ),
      ).rejects.toMatchObject({ status: null, code, retryable: true });
    }
  });

  it("retries an SDK timeout, which has a name and no status either", async () => {
    const { client } = refusingClient(
      sesError("TimeoutError", "socket hang up", null),
    );
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).rejects.toMatchObject({
      status: null,
      code: "TimeoutError",
      retryable: true,
    });
  });

  it("still reads a modeled exception by its name, which carries no socket code", async () => {
    // The control for the precedence above: the two vocabularies never appear
    // together, so preferring the code must not cost the exception name.
    const { client } = refusingClient(
      sesError("MessageRejected", "rejected", 400),
    );
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        DEPS(client),
      ),
    ).rejects.toMatchObject({ code: "MessageRejected" });
  });
});

/**
 * Provider prose does not stop at the log. It becomes the thrown error's
 * message, which a caller can persist on a row, so it is scrubbed where it
 * enters rather than at each place it might come to rest.
 */
describe("provider text is scrubbed before it can be kept", () => {
  it("redacts addresses out of the thrown message", async () => {
    const { client } = refusingClient(
      sesError(
        "MessageRejected",
        "The following identities failed the check in region US-EAST-1: victim@customer.test",
        400,
      ),
    );
    const error = await sendViaSes(
      { from: "hi@platform.test", to: "victim@customer.test", subject: "s" },
      DEPS(client),
    ).then(
      () => {
        throw new Error("expected SES to reject");
      },
      (e: unknown) => e as SesEmailError,
    );

    expect(error.message).not.toContain("victim@customer.test");
    expect(error.message).toContain("[address]");
  });

  /**
   * Every one of these is a legal RFC 5321 address form that SES echoes back as
   * it was given, and the sink is a stored column: the job queue writes this
   * text to `job_queue.last_error`. Under the sending sandbox a rejection
   * quoting the recipient is the ordinary case, not an edge case.
   */
  it("redacts the address forms a validator would reject but a provider echoes", () => {
    // A quoted local part. The quotes are what make the space legal, and they
    // are also what a pattern built from "not a delimiter" runs aground on.
    expect(safeDetail('rejected: "jane doe"@customer.test')).toBe(
      "rejected: [address]",
    );
    expect(safeDetail('rejected: "j.doe"@customer.test')).toBe(
      "rejected: [address]",
    );
    // An address literal: the domain is in brackets instead of the DNS.
    expect(safeDetail("rejected: victim@[192.0.2.1]")).toBe(
      "rejected: [address]",
    );
    // Folded across a line break, which is what a quoted header arrives as.
    expect(safeDetail("rejected: victim@\r\n customer.test")).toBe(
      "rejected: [address]",
    );
    expect(safeDetail("rejected: victim\r\n @customer.test")).toBe(
      "rejected: [address]",
    );
  });

  it("takes the display name with the address it labels", () => {
    // The name is the person as surely as the address is, so redacting only
    // what sits inside the angle brackets keeps the identifying half. Nothing
    // syntactic separates a display name from the prose in front of it, so the
    // phrase is bounded at three words and the last word of the sentence goes
    // with it. Losing a word of prose is the right side of that trade.
    const scrubbed = safeDetail("rejected for Jane Doe <jane@customer.test>");
    expect(scrubbed).not.toContain("Jane");
    expect(scrubbed).not.toContain("Doe");
    expect(scrubbed).toBe("rejected [address]");
    expect(safeDetail('"Doe, Jane" <jane@customer.test> failed')).toBe(
      "[address] failed",
    );
  });

  it("leaves the provider prose around a redaction intact", () => {
    // The point of keeping any of this is diagnosis, so the redaction must not
    // swallow the sentence that says what went wrong.
    expect(
      safeDetail(
        "Email address is not verified. The following identities failed: victim@c.test",
      ),
    ).toBe(
      "Email address is not verified. The following identities failed: [address]",
    );
  });

  it("squashes newlines and control characters, and caps the length", () => {
    expect(safeDetail("one\ntwo\r\nthree")).toBe("one two three");
    // A terminal escape is the control character that matters: it is not
    // whitespace, so collapsing runs of spaces would leave it intact, and it
    // renders as something other than itself wherever the text lands.
    expect(safeDetail("red \u001b[31malert")).toBe("red [31malert");
    expect(safeDetail("x".repeat(500)).length).toBe(200);
    expect(safeDetail(undefined)).toBe("");
  });
});

describe("stripPlatformControlledHeaders", () => {
  it("drops the platform-controlled set and keeps threading + extension headers", () => {
    const { headers, dropped } = stripPlatformControlledHeaders({
      "Message-ID": "<ours@platform.test>",
      "In-Reply-To": "<parent@platform.test>",
      References: "<root@platform.test> <parent@platform.test>",
      Date: "Mon, 1 Jan 2024 00:00:00 +0000",
      "X-Quackback-Kind": "reply",
    });
    expect(headers).toEqual({
      "In-Reply-To": "<parent@platform.test>",
      References: "<root@platform.test> <parent@platform.test>",
      "X-Quackback-Kind": "reply",
    });
    expect(dropped.sort()).toEqual(["Date", "Message-ID"]);
  });

  it("matches header names case-insensitively", () => {
    const { headers, dropped } = stripPlatformControlledHeaders({
      "message-id": "<x@y>",
    });
    expect(headers).toEqual({});
    expect(dropped).toEqual(["message-id"]);
  });
});

describe("dispatch on the ses rung", () => {
  withCleanEnv();

  beforeEach(() => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_SES_REGION = "us-east-1";
  });

  it("strips Message-ID but sends In-Reply-To and References", async () => {
    const result = await sendRawEmail({
      from: sendingAs("Support <support@platform.test>"),
      to: "customer@example.test",
      subject: "Re: your question",
      html: "<p>hi</p>",
      messageId: "c.abc.nonce@platform.test",
      inReplyTo: "parent@platform.test",
      references: ["root@platform.test", "parent@platform.test"],
    });

    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Headers).toEqual([
      { Name: "In-Reply-To", Value: "<parent@platform.test>" },
      {
        Name: "References",
        Value: "<root@platform.test> <parent@platform.test>",
      },
    ]);
    // The assigned id comes back so the caller stores the id that was actually
    // sent rather than the one it minted and never got.
    expect(result).toEqual({ sent: true, messageId: "ses-assigned-1" });
  });

  it("completes a prior assigned id in the chain, through the env-driven path", async () => {
    // The shape production actually takes: the store hands back the ids this
    // transport reported, which are bare, and the region that built the client
    // is the region whose host finishes them.
    process.env.EMAIL_SES_REGION = "eu-west-2";
    const result = await sendRawEmail({
      from: sendingAs("Support <support@platform.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
      inReplyTo: "0100018f-abc",
      references: ["0100018f-abc"],
    });

    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Headers).toEqual([
      { Name: "In-Reply-To", Value: "<0100018f-abc@eu-west-2.amazonses.com>" },
      { Name: "References", Value: "<0100018f-abc@eu-west-2.amazonses.com>" },
    ]);
    // Recorded bare all the same: the header is where the region is guessed at,
    // and the row is where it must not be.
    expect(result).toEqual({ sent: true, messageId: "ses-assigned-1" });
  });

  it("keeps a display-name From as one RFC 5322 string", async () => {
    await sendRawEmail({
      from: sendingAs("Support <support@platform.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe(
      "Support <support@platform.test>",
    );
  });

  it("corrects a From whose display name would parse as a second address", async () => {
    // The correction is the transport's, not the caller's: this string is
    // whatever the operator typed into configuration, and no route in
    // validates it.
    await sendRawEmail({
      from: sendingAs("Acme, Inc <support@platform.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
      replyTo: "Acme, Inc <c.abc@platform.test>",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe(
      '"Acme, Inc" <support@platform.test>',
    );
    expect(command.input.ReplyToAddresses).toEqual([
      '"Acme, Inc" <c.abc@platform.test>',
    ]);
  });

  it("wraps From with fromDisplayName on the SES FromEmailAddress", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    await sendConversationMessageEmail({
      to: "customer@example.test",
      direction: "agent_reply",
      senderName: "Alex",
      messagePreview: "hello",
      bodyHtml: "<p>hello</p>",
      ctaUrl: "https://acme.example/c",
      workspaceName: "Acme",
      channel: "email",
      fromDisplayName: "Alex (Acme)",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe(
      '"Alex (Acme)" <notifications@platform.test>',
    );
  });

  it("renders a text/plain alternative and uses the human reply subject", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    await sendConversationMessageEmail({
      to: "customer@example.test",
      direction: "agent_reply",
      senderName: "Alex",
      messagePreview: "I checked the invoice.",
      bodyHtml: "<p>I checked the invoice.</p>",
      ctaUrl: "https://acme.example/support/c1",
      workspaceName: "Acme",
      channel: "email",
      conversationSubject: "Re: Billing overcharge",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Subject?.Data).toBe(
      "Re: Billing overcharge",
    );
    expect(command.input.Content?.Simple?.Body?.Text?.Data).toMatch(
      /I checked the invoice/,
    );
    expect(command.input.Content?.Simple?.Body?.Html?.Data).toContain(
      "I checked the invoice.",
    );
    expect(command.input.Content?.Simple?.Body?.Html?.Data).not.toContain(
      "New reply from Acme",
    );
    expect(command.input.Content?.Simple?.Body?.Html?.Data).not.toContain(
      "Unsubscribe",
    );
  });

  it("carries RFC 8058 one-click unsubscribe headers on a changelog email", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    await sendChangelogPublishedEmail({
      to: "customer@example.test",
      changelogTitle: "May release",
      changelogUrl: "https://acme.example/changelog/1",
      contentPreview: "New things",
      workspaceName: "Acme",
      unsubscribeUrl: "https://acme.example/unsubscribe?token=tok-changelog",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Headers).toEqual([
      {
        Name: "List-Unsubscribe",
        Value: "<https://acme.example/unsubscribe?token=tok-changelog>",
      },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("carries them on a post update email, with that email’s own link", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    await sendNewCommentEmail({
      to: "customer@example.test",
      postTitle: "Dark mode",
      postUrl: "https://acme.example/b/x/posts/1",
      commenterName: "Ada",
      commentPreview: "Shipped!",
      isTeamMember: true,
      workspaceName: "Acme",
      unsubscribeUrl: "https://acme.example/unsubscribe?token=tok-post",
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Headers).toEqual([
      {
        Name: "List-Unsubscribe",
        Value: "<https://acme.example/unsubscribe?token=tok-post>",
      },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("offers no one-click over plain http, and no header at all without a link", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    const mention = (unsubscribeUrl?: string) =>
      sendPostMentionEmail({
        to: "customer@example.test",
        mentionerName: "Ada",
        postTitle: "Dark mode",
        excerpt: "",
        postUrl: "http://localhost:3000/b/x/posts/1",
        workspaceName: "Acme",
        unsubscribeUrl,
      });

    await mention("http://localhost:3000/unsubscribe?token=tok-dev");
    expect(
      (sdkSend.mock.calls[0][0] as SendEmailCommand).input.Content?.Simple
        ?.Headers,
    ).toEqual([
      {
        Name: "List-Unsubscribe",
        Value: "<http://localhost:3000/unsubscribe?token=tok-dev>",
      },
    ]);

    await mention("");
    expect(
      (sdkSend.mock.calls[1][0] as SendEmailCommand).input.Content?.Simple
        ?.Headers,
    ).toBeUndefined();
  });

  it("carries attachments all the way from sendRawEmail to the SES wire shape", async () => {
    const content = new TextEncoder().encode("id,name\n1,ada");
    await sendRawEmail({
      from: sendingAs("Support <support@platform.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>see attached</p>",
      attachments: [
        { filename: "export.csv", contentType: "text/csv", content },
      ],
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Attachments).toEqual([
      {
        RawContent: content,
        FileName: "export.csv",
        ContentType: "text/csv",
        ContentDisposition: "ATTACHMENT",
      },
    ]);
  });

  it("carries attachments through sendConversationMessageEmail as well", async () => {
    process.env.EMAIL_FROM = "notifications@platform.test";
    const content = new TextEncoder().encode("fake-bytes");
    await sendConversationMessageEmail({
      to: "customer@example.test",
      direction: "agent_reply",
      senderName: "Alex",
      messagePreview: "see attached",
      bodyHtml: "<p>see attached</p>",
      ctaUrl: "https://acme.example/c",
      workspaceName: "Acme",
      channel: "email",
      attachments: [
        { filename: "photo.png", contentType: "image/png", content },
      ],
    });
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Simple?.Attachments).toEqual([
      {
        RawContent: content,
        FileName: "photo.png",
        ContentType: "image/png",
        ContentDisposition: "ATTACHMENT",
      },
    ]);
  });

  it("still refuses a synthetic anonymous recipient before any request", async () => {
    const result = await sendRawEmail({
      from: sendingAs("Support <support@platform.test>"),
      to: "temp-abc123@anon.quills.io",
      subject: "s",
      html: "<p>hi</p>",
    });
    expect(result).toEqual({ sent: false, reason: "anon_recipient" });
    expect(sdkSend).not.toHaveBeenCalled();
  });
});

/**
 * The rung a workspace's OWN sending domain uses.
 *
 * SES verifies an identity from a DNS record the domain's owner publishes, so
 * it can sign for a domain it does not host. The ladder has no per-send
 * exception: a workspace that branded its mail sends by the same door as
 * everything else, and the rung below is not consulted.
 */
describe("a workspace sending as its own domain", () => {
  withCleanEnv();

  beforeEach(() => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIAEXAMPLE";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_SES_REGION = "us-east-1";
  });

  it("sends a customer-owned From through SES rather than dropping a rung", async () => {
    const result = await sendRawEmail({
      from: sendingAs("Support <support@customer-owned.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
    });

    expect(sdkSend).toHaveBeenCalledTimes(1);
    const command = sdkSend.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe(
      "Support <support@customer-owned.test>",
    );
    expect(result).toEqual({ sent: true, messageId: "ses-assigned-1" });
  });
});

describe("a self-hoster on SMTP", () => {
  withCleanEnv();

  it("never reaches SES for a send, whatever the From", async () => {
    process.env.EMAIL_SMTP_HOST = "smtp.invalid.test";

    await sendRawEmail({
      from: sendingAs("Support <support@customer-owned.test>"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
    }).catch(() => undefined);

    expect(sdkSend).not.toHaveBeenCalled();
  });
});

describe("why a send did not happen", () => {
  withCleanEnv();

  it("reports no provider when nothing is configured", async () => {
    expect(
      await sendRawEmail({
        from: sendingAs("a@b.test"),
        to: "c@d.test",
        subject: "s",
        html: "<p>hi</p>",
      }),
    ).toEqual({ sent: false, reason: "no_provider" });
  });

  /**
   * A rung that reports a clean outcome while delivering nothing is the worst
   * failure available here, and it was also the quietest: the preview line sits
   * at `debug` and production defaults to `info`, so a deploy dropping every
   * notification emitted no line at all.
   */
  it("says so at a level production ships, without naming the recipient", async () => {
    logWarn.mockClear();

    await sendRawEmail({
      from: sendingAs("a@b.test"),
      to: "customer@example.test",
      subject: "s",
      html: "<p>hi</p>",
    });

    expect(logWarn).toHaveBeenCalledTimes(1);
    const [fields, message] = logWarn.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(message).toMatch(/not delivered/);
    // The address never rides along. This line is meant to be shipped.
    expect(JSON.stringify(fields)).not.toContain("customer@example.test");
  });

  it("says it once per dropped message, not once per process", async () => {
    // One line per dropped message is proportional to the damage and survives a
    // log window that opened after the first send.
    logWarn.mockClear();
    for (let i = 0; i < 3; i++) {
      await sendRawEmail({
        from: sendingAs("a@b.test"),
        to: "c@d.test",
        subject: "s",
        html: "<p>hi</p>",
      });
    }
    expect(logWarn).toHaveBeenCalledTimes(3);
  });
});

/**
 * Throttling is the provider saying "not this second", which every caller above
 * this transport retries. It is logged at warn so an error line keeps meaning a
 * send that went wrong; the caller that finally gives up logs that at error.
 */
describe("throttling", () => {
  const send = (client: SesSendClient) =>
    sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      DEPS(client),
    );

  it("retries a send-rate rejection and logs it at warn, not error", async () => {
    const { client } = refusingClient(
      sesError(
        "TooManyRequestsException",
        "Maximum sending rate exceeded.",
        429,
      ),
    );
    await expect(send(client)).rejects.toMatchObject({
      status: 429,
      code: "TooManyRequestsException",
      retryable: true,
    });
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 429,
        code: "TooManyRequestsException",
      }),
      "ses email send throttled",
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("treats the older Throttling name as the same thing, whatever its status", async () => {
    const { client } = refusingClient(
      sesError("Throttling", "Maximum sending rate exceeded.", 400),
    );
    await expect(send(client)).rejects.toMatchObject({
      code: "Throttling",
      retryable: true,
    });
    expect(logWarn).toHaveBeenCalledWith(
      expect.anything(),
      "ses email send throttled",
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("still logs a rejection of the message itself at error", async () => {
    const { client } = refusingClient(
      sesError("MessageRejected", "not verified", 400),
    );
    await expect(send(client)).rejects.toMatchObject({ retryable: false });
    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      "ses email send failed",
    );
  });
});

describe("send rate", () => {
  withCleanEnv();

  it("defaults to a rate safely under the smallest production quota", () => {
    expect(DEFAULT_SES_MAX_SEND_RATE).toBe(10);
    expect(sesMaxSendRate()).toBe(10);
    expect(sesSendRateLimiter().ratePerSecond).toBe(10);
  });

  it("takes the per-process rate from EMAIL_SES_MAX_SEND_RATE", () => {
    process.env.EMAIL_SES_MAX_SEND_RATE = "4.5";
    expect(sesMaxSendRate()).toBe(4.5);
    expect(sesSendRateLimiter().ratePerSecond).toBe(4.5);
  });

  it("falls back to the default for a value that is not a positive rate", () => {
    for (const bad of ["0", "-3", "fast", "Infinity"]) {
      process.env.EMAIL_SES_MAX_SEND_RATE = bad;
      expect(sesMaxSendRate(), bad).toBe(10);
    }
  });

  it("waits for a slot before the send reaches SES", async () => {
    let release!: () => void;
    const limiter: SendRateLimiter = {
      ratePerSecond: 1,
      acquire: () => new Promise<void>((resolve) => (release = resolve)),
    };
    const { client, send } = acceptingClient("id-1");
    const pending = sendViaSes(
      { from: "hi@platform.test", to: "a@b.test", subject: "s" },
      { ...DEPS(client), limiter },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(send).not.toHaveBeenCalled();
    release();
    await expect(pending).resolves.toEqual({ messageId: "id-1" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("paces sends through the process-wide limiter on the env-driven path", async () => {
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIA";
    process.env.EMAIL_SES_SECRET_ACCESS_KEY = "secret";
    process.env.EMAIL_SES_REGION = "us-east-1";
    // 20/s: one send every 50ms.
    process.env.EMAIL_SES_MAX_SEND_RATE = "20";
    const at: number[] = [];
    sdkSend.mockImplementation(async () => {
      at.push(performance.now());
      return {
        MessageId: "ses-assigned-1",
        $metadata: { httpStatusCode: 200 },
      };
    });
    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        sendViaSes({
          from: "hi@platform.test",
          to: `a${n}@b.test`,
          subject: "s",
        }),
      ),
    );
    expect(at).toHaveLength(4);
    // Slots are booked 50ms apart up front, so the last send leaves at least
    // ~150ms after the first; unpaced, all four land within a millisecond.
    // Measured across the whole run, not per gap: a loaded runner can delay
    // one send, which shortens the gap after it without breaking the pace.
    expect(at[at.length - 1] - at[0]).toBeGreaterThanOrEqual(120);
  });

  it("turns a full line into a retryable rate-limit error without sending", async () => {
    const limiter: SendRateLimiter = {
      ratePerSecond: 10,
      acquire: async () => {
        throw new SendRateQueueFullError(45_000);
      },
    };
    const { client, send } = acceptingClient("id-1");
    await expect(
      sendViaSes(
        { from: "hi@platform.test", to: "a@b.test", subject: "s" },
        { ...DEPS(client), limiter },
      ),
    ).rejects.toMatchObject({
      name: "SesEmailError",
      status: 429,
      retryable: true,
    });
    expect(send).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });
});
