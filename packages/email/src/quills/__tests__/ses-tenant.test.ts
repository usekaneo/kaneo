/**
 * Tenant management calls, offline, with the command inputs asserted.
 */
import { describe, it, expect, vi } from "vite-plus/test";
import {
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteTenantResourceAssociationCommand,
  GetReputationEntityCommand,
  GetTenantCommand,
} from "@aws-sdk/client-sesv2";
import {
  SesTenantError,
  associateSesTenantResource,
  disassociateSesTenantResource,
  ensureSesTenant,
  getSesTenantReputation,
  sesArnPrefix,
  sesConfigurationSetArn,
  sesIdentityArn,
  sesTenantsConfigProblem,
  sesTenantsEnabled,
} from "../ses-tenant";
import type { SesTenantClient, SesTenantDeps } from "../ses-tenant";

vi.mock("@kaneo/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@kaneo/logger")>();
  const logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child: () => logger,
  };
  return { ...actual, createLogger: () => logger };
});

const TENANT_ARN = "arn:aws:ses:eu-west-2:123456789012:tenant/ws-abc/t-1";

function fake(handler: (command: unknown) => unknown): {
  deps: SesTenantDeps;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const client: SesTenantClient = {
    send: async (command) => {
      sent.push(command);
      const result = handler(command);
      if (result instanceof Error) throw result;
      return result as never;
    },
  };
  return { deps: { client }, sent };
}

function serviceError(name: string, status: number, message = "nope"): Error {
  return Object.assign(new Error(message), {
    name,
    $metadata: { httpStatusCode: status },
  });
}

describe("settings", () => {
  it("is off unless EMAIL_SES_TENANTS says true or 1", () => {
    expect(sesTenantsEnabled({})).toBe(false);
    expect(sesTenantsEnabled({ EMAIL_SES_TENANTS: "false" })).toBe(false);
    expect(sesTenantsEnabled({ EMAIL_SES_TENANTS: " TRUE " })).toBe(true);
    expect(sesTenantsEnabled({ EMAIL_SES_TENANTS: "1" })).toBe(true);
  });

  it("names what is missing when tenants are on without a configuration set or identity key", () => {
    const on = { EMAIL_SES_TENANTS: "true" };
    const full = {
      ...on,
      EMAIL_SES_CONFIGURATION_SET: "quackback",
      EMAIL_SES_IDENTITY_ACCESS_KEY_ID: "AKIA",
      EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY: "s",
    };
    expect(sesTenantsConfigProblem({})).toBeNull();
    expect(sesTenantsConfigProblem(full)).toBeNull();
    expect(
      sesTenantsConfigProblem({ ...full, EMAIL_SES_CONFIGURATION_SET: "" }),
    ).toContain("EMAIL_SES_CONFIGURATION_SET");
    expect(
      sesTenantsConfigProblem({
        ...full,
        EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY: undefined,
      }),
    ).toContain("EMAIL_SES_IDENTITY_ACCESS_KEY_ID");
  });
});

describe("ensureSesTenant", () => {
  it("creates the tenant by name and reads its ARN", async () => {
    const { deps, sent } = fake(() => ({
      TenantArn: TENANT_ARN,
      SendingStatus: "ENABLED",
    }));
    expect(await ensureSesTenant("ws-abc", deps)).toEqual({
      name: "ws-abc",
      arn: TENANT_ARN,
      sendingStatus: "ENABLED",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(CreateTenantCommand);
    expect((sent[0] as CreateTenantCommand).input).toEqual({
      TenantName: "ws-abc",
    });
  });

  it("describes an existing tenant instead of failing", async () => {
    const { deps, sent } = fake((command) =>
      command instanceof CreateTenantCommand
        ? serviceError("AlreadyExistsException", 400)
        : { Tenant: { TenantArn: TENANT_ARN, SendingStatus: "DISABLED" } },
    );
    const tenant = await ensureSesTenant("ws-abc", deps);
    expect(tenant.arn).toBe(TENANT_ARN);
    expect(tenant.sendingStatus).toBe("DISABLED");
    expect(sent[1]).toBeInstanceOf(GetTenantCommand);
    expect((sent[1] as GetTenantCommand).input).toEqual({
      TenantName: "ws-abc",
    });
  });

  it("names the grant when access is denied", async () => {
    const { deps } = fake(() => serviceError("AccessDeniedException", 403));
    const error = await ensureSesTenant("ws-abc", deps).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SesTenantError);
    expect((error as Error).message).toContain("ses:CreateTenant");
    expect((error as SesTenantError).retryable).toBe(false);
  });
});

describe("associations", () => {
  const arn = "arn:aws:ses:eu-west-2:123456789012:identity/acme.test";

  it("associates a resource with the tenant", async () => {
    const { deps, sent } = fake(() => ({}));
    await associateSesTenantResource("ws-abc", arn, deps);
    expect(sent[0]).toBeInstanceOf(CreateTenantResourceAssociationCommand);
    expect((sent[0] as CreateTenantResourceAssociationCommand).input).toEqual({
      TenantName: "ws-abc",
      ResourceArn: arn,
    });
  });

  it("treats an existing association as done", async () => {
    const { deps } = fake(() => serviceError("AlreadyExistsException", 400));
    await expect(
      associateSesTenantResource("ws-abc", arn, deps),
    ).resolves.toBeUndefined();
  });

  it("fails retryably on a provider fault", async () => {
    const { deps } = fake(() => serviceError("InternalFailure", 500));
    const error = await associateSesTenantResource("ws-abc", arn, deps).catch(
      (e: unknown) => e,
    );
    expect((error as SesTenantError).retryable).toBe(true);
  });

  it("releases a resource, and an absent association is done", async () => {
    const { deps, sent } = fake(() => serviceError("NotFoundException", 404));
    await expect(
      disassociateSesTenantResource("ws-abc", arn, deps),
    ).resolves.toBeUndefined();
    expect(sent[0]).toBeInstanceOf(DeleteTenantResourceAssociationCommand);
    expect((sent[0] as DeleteTenantResourceAssociationCommand).input).toEqual({
      TenantName: "ws-abc",
      ResourceArn: arn,
    });
  });
});

describe("getSesTenantReputation", () => {
  it("asks for the tenant as a resource entity and reads the combined status", async () => {
    const { deps, sent } = fake(() => ({
      ReputationEntity: { SendingStatusAggregate: "ENABLED" },
    }));
    expect(await getSesTenantReputation(TENANT_ARN, deps)).toEqual({
      status: "ENABLED",
      cause: null,
    });
    expect(sent[0]).toBeInstanceOf(GetReputationEntityCommand);
    expect((sent[0] as GetReputationEntityCommand).input).toEqual({
      ReputationEntityType: "RESOURCE",
      ReputationEntityReference: TENANT_ARN,
    });
  });

  it("reads the cause from whichever side paused it", async () => {
    const { deps } = fake(() => ({
      ReputationEntity: {
        SendingStatusAggregate: "DISABLED",
        CustomerManagedStatus: { Status: "ENABLED", Cause: "fine" },
        AwsSesManagedStatus: {
          Status: "DISABLED",
          Cause: "Bounce rate above threshold.",
        },
      },
    }));
    expect(await getSesTenantReputation(TENANT_ARN, deps)).toEqual({
      status: "DISABLED",
      cause: "Bounce rate above threshold.",
    });
  });
});

describe("resource names", () => {
  it("reads the account prefix off a tenant ARN and names resources beside it", () => {
    const prefix = sesArnPrefix(TENANT_ARN);
    expect(prefix).toBe("arn:aws:ses:eu-west-2:123456789012");
    expect(sesIdentityArn(prefix!, "acme.test")).toBe(
      "arn:aws:ses:eu-west-2:123456789012:identity/acme.test",
    );
    expect(sesConfigurationSetArn(prefix!, "quackback")).toBe(
      "arn:aws:ses:eu-west-2:123456789012:configuration-set/quackback",
    );
    expect(
      sesArnPrefix("arn:aws:ses:eu-west-2:123456789012:identity/x"),
    ).toBeNull();
  });
});
