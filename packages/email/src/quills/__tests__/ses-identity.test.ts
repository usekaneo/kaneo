/**
 * The identity-provisioning rung, offline. Every call here goes through an
 * injected client; nothing in this file may touch the network, and nothing in it
 * creates a real identity.
 *
 * Two properties carry the weight. The credential is separate from the sending
 * one and a missing grant is named rather than guessed at, because the failure
 * this replaces is an opaque `AccessDenied` on an action nobody wrote down. And
 * the custom MAIL FROM is attached with a fallback rather than a rejection, so a
 * DNS regression a year later costs SPF alignment instead of every outbound
 * reply.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityDkimSigningAttributesCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from "@aws-sdk/client-sesv2";
import {
  SES_IDENTITY_ACTIONS,
  SES_MAIL_FROM_MX_PRIORITY,
  SES_MAIL_FROM_SPF_VALUE,
  SesIdentityConfigError,
  SesIdentityError,
  createSesDomainIdentity,
  getSesDomainIdentity,
  isSesIdentityConfigured,
  putSesDkimSigningKey,
  putSesMailFromDomain,
  sesDkimCnameTarget,
  sesMailFromMxValue,
  sesReturnPathDomain,
} from "../ses-identity";
import type { SesIdentityClient, SesIdentityDeps } from "../ses-identity";

const REGION = "eu-west-2";

/** A client that records what it was asked and answers with what it is told. */
function fakeClient(handler: (command: unknown) => unknown): {
  deps: SesIdentityDeps;
  commands: unknown[];
} {
  const commands: unknown[] = [];
  const client: SesIdentityClient = {
    send: async (command) => {
      commands.push(command);
      const result = handler(command);
      if (result instanceof Error) throw result;
      return result as never;
    },
  };
  return { deps: { client, region: REGION }, commands };
}

/** An SDK-shaped service exception. */
function serviceError(name: string, status: number, message = "nope"): Error {
  return Object.assign(new Error(message), {
    name,
    $metadata: { httpStatusCode: status },
  });
}

const ENV_KEYS = [
  "EMAIL_SES_IDENTITY_ACCESS_KEY_ID",
  "EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY",
  "EMAIL_SES_REGION",
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

describe("the provisioning credential", () => {
  withCleanEnv();

  it("is not the sending credential, and is absent until both halves are set", () => {
    expect(isSesIdentityConfigured()).toBe(false);
    process.env.EMAIL_SES_IDENTITY_ACCESS_KEY_ID = "AKIA";
    expect(isSesIdentityConfigured()).toBe(false);
    process.env.EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY = "secret";
    expect(isSesIdentityConfigured()).toBe(true);
    // The sending credential is a different principal and does not stand in.
    delete process.env.EMAIL_SES_IDENTITY_ACCESS_KEY_ID;
    process.env.EMAIL_SES_ACCESS_KEY_ID = "AKIA-send";
    expect(isSesIdentityConfigured()).toBe(false);
    delete process.env.EMAIL_SES_ACCESS_KEY_ID;
  });

  it("refuses by naming the variables and the exact actions to grant", async () => {
    const error = await createSesDomainIdentity("tenant-a.example").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(SesIdentityConfigError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("EMAIL_SES_IDENTITY_ACCESS_KEY_ID");
    expect(error.message).toContain("EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY");
    for (const action of SES_IDENTITY_ACTIONS)
      expect(error.message).toContain(action);
    // And says which one must NOT be granted, since that is the grant whose
    // blast radius is every other workspace's mail.
    expect(error.message).toContain("ses:DeleteEmailIdentity");
  });

  it("refuses a missing region rather than guessing one", async () => {
    process.env.EMAIL_SES_IDENTITY_ACCESS_KEY_ID = "AKIA";
    process.env.EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY = "secret";
    const error = await getSesDomainIdentity("tenant-a.example").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(SesIdentityConfigError);
    expect(error.message).toContain("EMAIL_SES_REGION");
  });
});

describe("this module cannot delete an identity", () => {
  it("never imports a delete command from the provider SDK", () => {
    // Structural, not behavioural: the guarantee is that no code path exists to
    // test, so what is checked is what the module is allowed to import. A
    // process that can delete identities can stop every other workspace on the
    // account from sending, and that is not a capability a tenant-facing tier
    // should be one refactor away from having.
    const source = readFileSync(
      fileURLToPath(new URL("../ses-identity.ts", import.meta.url)),
      "utf8",
    );
    const imported = [
      ...source.matchAll(
        /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']@aws-sdk\/client-sesv2["']/g,
      ),
    ];
    expect(imported.length).toBeGreaterThan(0);
    for (const [, names] of imported) expect(names).not.toMatch(/Delete/);
  });
});

describe("creating a domain identity", () => {
  it("asks for Easy DKIM at a stated key length and reads the tokens back", async () => {
    const { deps, commands } = fakeClient(() => ({
      DkimAttributes: { Tokens: ["aaa", "bbb", "ccc"], Status: "PENDING" },
      VerifiedForSendingStatus: false,
    }));
    const created = await createSesDomainIdentity("tenant-a.example", deps);

    expect(commands[0]).toBeInstanceOf(CreateEmailIdentityCommand);
    expect((commands[0] as CreateEmailIdentityCommand).input).toEqual({
      EmailIdentity: "tenant-a.example",
      DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
    });
    // Reported as ours, which is what entitles the caller to the writes that
    // follow a create.
    expect(created.preexisting).toBe(false);
    expect(created.identity).toEqual({
      domain: "tenant-a.example",
      dkimTokens: ["aaa", "bbb", "ccc"],
      signingHostedZone: null,
      dkimStatus: "PENDING",
      verifiedForSending: false,
      mailFrom: null,
    });
  });

  it("creates the identity with a key of our own when given one, and never logs it", async () => {
    const { deps, commands } = fakeClient(() => ({
      DkimAttributes: { Tokens: ["qb1a2b3c4d"], Status: "PENDING" },
      VerifiedForSendingStatus: false,
    }));
    const logged = vi.spyOn(process.stdout, "write");
    await createSesDomainIdentity("tenant-a.example", deps, {
      selector: "qb1a2b3c4d",
      privateKey: "UFJJVkFURUtFWQ==",
    });
    expect((commands[0] as CreateEmailIdentityCommand).input).toEqual({
      EmailIdentity: "tenant-a.example",
      DkimSigningAttributes: {
        DomainSigningSelector: "qb1a2b3c4d",
        DomainSigningPrivateKey: "UFJJVkFURUtFWQ==",
      },
    });
    const output = logged.mock.calls.map(([chunk]) => String(chunk)).join("");
    logged.mockRestore();
    expect(output).not.toContain("UFJJVkFURUtFWQ==");
  });

  it("does not re-key an identity that already exists", async () => {
    const { deps, commands } = fakeClient((command) =>
      command instanceof CreateEmailIdentityCommand
        ? serviceError("AlreadyExistsException", 400)
        : {
            DkimAttributes: { Status: "SUCCESS" },
            VerifiedForSendingStatus: true,
          },
    );
    const created = await createSesDomainIdentity("tenant-a.example", deps, {
      selector: "qb1a2b3c4d",
      privateKey: "UFJJVkFURUtFWQ==",
    });
    expect(created.preexisting).toBe(true);
    // A create that bounced, then a read: nothing that sets signing attributes.
    expect(commands.map((c) => (c as object).constructor.name)).toEqual([
      "CreateEmailIdentityCommand",
      "GetEmailIdentityCommand",
    ]);
  });

  it.each([
    ["AWS_SES", "ses"],
    ["AWS_SES_EU_WEST_2", "ses"],
    ["EXTERNAL", "external"],
  ])("reads a %s signing key as %s", async (origin, expected) => {
    const { deps } = fakeClient((command) =>
      command instanceof CreateEmailIdentityCommand
        ? serviceError("AlreadyExistsException", 400)
        : {
            DkimAttributes: {
              Status: "SUCCESS",
              SigningAttributesOrigin: origin,
            },
          },
    );
    const created = await createSesDomainIdentity("tenant-a.example", deps);
    expect(created.identity.signingOrigin).toBe(expected);
  });

  it("reads an identity that already exists rather than failing", async () => {
    // The customer clicking Add twice, a retried job, and an identity another
    // workspace created all arrive here. None of them is an error, and none of
    // them is proof of ownership either.
    const { deps, commands } = fakeClient((command) =>
      command instanceof CreateEmailIdentityCommand
        ? serviceError("AlreadyExistsException", 400)
        : {
            DkimAttributes: {
              Tokens: ["aaa"],
              Status: "SUCCESS",
              SigningHostedZone: "z.example",
            },
            VerifiedForSendingStatus: true,
            MailFromAttributes: {
              MailFromDomain: "bounce.tenant-a.example",
              MailFromDomainStatus: "SUCCESS",
            },
          },
    );
    const created = await createSesDomainIdentity("tenant-a.example", deps);
    expect(commands[1]).toBeInstanceOf(GetEmailIdentityCommand);
    // The load-bearing half of the answer: this identity was NOT created by
    // this call, so nothing that follows may assume the caller owns it.
    expect(created.preexisting).toBe(true);
    expect(created.identity.verifiedForSending).toBe(true);
    expect(created.identity.signingHostedZone).toBe("z.example");
    expect(created.identity.mailFrom).toEqual({
      domain: "bounce.tenant-a.example",
      status: "SUCCESS",
    });
  });

  it("says which action to grant when the call is denied", async () => {
    const { deps } = fakeClient(() =>
      serviceError("AccessDeniedException", 403, "not authorized"),
    );
    const error = await createSesDomainIdentity("tenant-a.example", deps).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(SesIdentityError);
    expect(error.code).toBe("AccessDeniedException");
    expect(error.message).toContain("ses:CreateEmailIdentity");
    expect(error.message).toContain("EMAIL_SES_IDENTITY_ACCESS_KEY_ID");
    // A denial is a decision nobody has made yet, not a moment that passes.
    expect(error.retryable).toBe(false);
  });

  it("treats a failure that never reached the provider as retryable", async () => {
    const { deps } = fakeClient(() =>
      Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    );
    const error = await createSesDomainIdentity("tenant-a.example", deps).catch(
      (e) => e,
    );
    expect(error.code).toBe("ECONNRESET");
    expect(error.status).toBeNull();
    expect(error.retryable).toBe(true);
  });

  it("treats the provider’s own fault as retryable and its verdict as not", async () => {
    const { deps: server } = fakeClient(() =>
      serviceError("InternalServiceError", 500),
    );
    expect(
      (await createSesDomainIdentity("a.example", server).catch((e) => e))
        .retryable,
    ).toBe(true);
    const { deps: throttle } = fakeClient(() =>
      serviceError("TooManyRequestsException", 429),
    );
    expect(
      (await createSesDomainIdentity("a.example", throttle).catch((e) => e))
        .retryable,
    ).toBe(true);
    const { deps: bad } = fakeClient(() =>
      serviceError("BadRequestException", 400),
    );
    expect(
      (await createSesDomainIdentity("a.example", bad).catch((e) => e))
        .retryable,
    ).toBe(false);
  });
});

describe("reading an identity", () => {
  it("reports null for a domain the provider has never heard of", async () => {
    const { deps } = fakeClient(() => serviceError("NotFoundException", 404));
    expect(await getSesDomainIdentity("tenant-a.example", deps)).toBeNull();
  });

  it("reports an identity with no DKIM block as unverified rather than throwing", async () => {
    const { deps } = fakeClient(() => ({}));
    expect(await getSesDomainIdentity("tenant-a.example", deps)).toEqual({
      domain: "tenant-a.example",
      dkimTokens: [],
      signingHostedZone: null,
      dkimStatus: null,
      verifiedForSending: false,
      mailFrom: null,
    });
  });
});

describe("the custom MAIL FROM", () => {
  it("falls back to the provider’s domain on MX failure instead of rejecting the message", async () => {
    // The alternative, REJECT_MESSAGE, turns a customer's later DNS
    // reorganisation into every outbound reply disappearing. The fallback costs
    // SPF ALIGNMENT and keeps delivery, and DKIM still carries DMARC on its own.
    const { deps, commands } = fakeClient(() => ({}));
    await putSesMailFromDomain(
      "tenant-a.example",
      "bounce.tenant-a.example",
      deps,
    );
    expect(commands[0]).toBeInstanceOf(
      PutEmailIdentityMailFromAttributesCommand,
    );
    expect(
      (commands[0] as PutEmailIdentityMailFromAttributesCommand).input,
    ).toEqual({
      EmailIdentity: "tenant-a.example",
      MailFromDomain: "bounce.tenant-a.example",
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    });
  });

  it("names its own action when denied", async () => {
    const { deps } = fakeClient(() =>
      serviceError("AccessDeniedException", 403),
    );
    const error = await putSesMailFromDomain(
      "a.example",
      "bounce.a.example",
      deps,
    ).catch((e) => e);
    expect(error.message).toContain("ses:PutEmailIdentityMailFromAttributes");
  });
});

describe("re-keying an identity to a caller-held key", () => {
  it("sets an external key under the given selector", async () => {
    const { deps, commands } = fakeClient(() => ({}));
    await putSesDkimSigningKey(
      "tenant-a.example",
      { selector: "qb0011aabb", privateKey: "PRIVATE-KEY-BASE64" },
      deps,
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(
      PutEmailIdentityDkimSigningAttributesCommand,
    );
    expect(
      (commands[0] as PutEmailIdentityDkimSigningAttributesCommand).input,
    ).toEqual({
      EmailIdentity: "tenant-a.example",
      SigningAttributesOrigin: "EXTERNAL",
      SigningAttributes: {
        DomainSigningSelector: "qb0011aabb",
        DomainSigningPrivateKey: "PRIVATE-KEY-BASE64",
      },
    });
  });

  it("names its own action when denied, and never carries the key in the error", async () => {
    const { deps } = fakeClient(() =>
      serviceError("AccessDeniedException", 403),
    );
    const error = await putSesDkimSigningKey(
      "a.example",
      { selector: "qb1", privateKey: "PRIVATE-KEY-BASE64" },
      deps,
    ).catch((e) => e);
    expect(error).toBeInstanceOf(SesIdentityError);
    expect(error.message).toContain(
      "ses:PutEmailIdentityDkimSigningAttributes",
    );
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      "PRIVATE-KEY-BASE64",
    );
  });

  it("is one of the actions the identity credential is told to hold", () => {
    expect(SES_IDENTITY_ACTIONS).toContain(
      "ses:PutEmailIdentityDkimSigningAttributes",
    );
  });
});

describe("the record values the provider expects to find", () => {
  it("prefers the zone the provider named over the derived one", async () => {
    // Newer regions publish keys somewhere other than dkim.<region>, and a CNAME
    // at the wrong zone resolves to nothing and never verifies.
    expect(sesDkimCnameTarget("aaa", { region: REGION })).toBe(
      `aaa.dkim.${REGION}.amazonses.com`,
    );
    expect(
      sesDkimCnameTarget("aaa", {
        region: REGION,
        signingHostedZone: "z.example",
      }),
    ).toBe("aaa.z.example");
    expect(
      sesDkimCnameTarget("aaa", { region: REGION, signingHostedZone: "  " }),
    ).toBe(`aaa.dkim.${REGION}.amazonses.com`);
  });

  it("points the bounce MX at the region’s feedback host", () => {
    expect(sesMailFromMxValue(REGION)).toBe(
      `feedback-smtp.${REGION}.amazonses.com`,
    );
    expect(SES_MAIL_FROM_MX_PRIORITY).toBe(10);
    expect(SES_MAIL_FROM_SPF_VALUE).toBe("v=spf1 include:amazonses.com ~all");
  });
});

describe("the operator return path domain", () => {
  it("is unset by default", () => {
    expect(sesReturnPathDomain({})).toBeNull();
    expect(sesReturnPathDomain({ EMAIL_RETURN_PATH_DOMAIN: "  " })).toBeNull();
  });

  it("reads the domain in one spelling", () => {
    expect(
      sesReturnPathDomain({
        EMAIL_RETURN_PATH_DOMAIN: " Bounces.Example.NET. ",
      }),
    ).toBe("bounces.example.net");
  });

  it.each([
    "bounces",
    "https://bounces.example.net",
    "*.bounces.example.net",
    "a..example.net",
  ])("ignores %s, which is not a domain name", (value) => {
    expect(sesReturnPathDomain({ EMAIL_RETURN_PATH_DOMAIN: value })).toBeNull();
  });
});

describe("a provider message never carries an address into a log or a row", () => {
  it("redacts the addresses the provider quotes back", async () => {
    const { deps } = fakeClient(() =>
      serviceError(
        "BadRequestException",
        400,
        "Identity jane.doe@tenant-a.example is not permitted here",
      ),
    );
    const error = await createSesDomainIdentity("tenant-a.example", deps).catch(
      (e) => e,
    );
    expect(error.message).not.toContain("jane.doe@tenant-a.example");
    expect(error.message).toContain("[address]");
  });
});
