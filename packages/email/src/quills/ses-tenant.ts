/**
 * Amazon SES tenants: reputation isolated per workspace on a shared account.
 *
 * Every workspace on a pooled deployment sends through one provider account,
 * and the provider judges bounce and complaint rates account-wide unless mail
 * is sent under a tenant. With tenants it tracks each tenant on its own and,
 * under the default policy, pauses only the tenant at fault, so one workspace
 * mailing a stale list stops its own mail rather than everyone's.
 *
 * A tenant sends only with a verified identity and a configuration set
 * associated with it, and the provider refuses a tenanted send whose From
 * identity or configuration set is not associated. The calls here create the
 * tenant, associate and release resources, and read the tenant's sending
 * status. They manage account resources, so they run on the identity
 * credential (see `sesManagementClient`), never the sending one.
 *
 * Off unless the operator sets `EMAIL_SES_TENANTS`.
 */
import {
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteTenantResourceAssociationCommand,
  GetReputationEntityCommand,
  GetTenantCommand,
} from "@aws-sdk/client-sesv2";
import type {
  CreateTenantCommandOutput,
  CreateTenantResourceAssociationCommandOutput,
  DeleteTenantResourceAssociationCommandOutput,
  GetReputationEntityCommandOutput,
  GetTenantCommandOutput,
} from "@aws-sdk/client-sesv2";
import { createLogger } from "@kaneo/logger";
import { safeDetail } from "./ses";
import { sesManagementClient } from "./ses-identity";

const log = createLogger({ base: { service_name: "quackback-email" } }).child({
  component: "email-ses-tenant",
});

type EnvLike = Record<string, string | undefined>;

export const SES_TENANTS_ENV = "EMAIL_SES_TENANTS";

/** Whether the operator turned per-workspace tenants on. */
export function sesTenantsEnabled(env: EnvLike = process.env): boolean {
  const value = env[SES_TENANTS_ENV]?.trim().toLowerCase();
  return value === "true" || value === "1";
}

/**
 * Why tenants cannot run on this configuration, or null when they can (or are
 * off). A tenant cannot send without a configuration set associated, and the
 * tenant calls need the identity credential, so turning tenants on without
 * either is refused at boot rather than found out at the first send.
 */
export function sesTenantsConfigProblem(
  env: EnvLike = process.env,
): string | null {
  if (!sesTenantsEnabled(env)) return null;
  const missing: string[] = [];
  if (!env.EMAIL_SES_CONFIGURATION_SET?.trim())
    missing.push("EMAIL_SES_CONFIGURATION_SET");
  if (
    !env.EMAIL_SES_IDENTITY_ACCESS_KEY_ID?.trim() ||
    !env.EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY?.trim()
  ) {
    missing.push(
      "EMAIL_SES_IDENTITY_ACCESS_KEY_ID and EMAIL_SES_IDENTITY_SECRET_ACCESS_KEY",
    );
  }
  if (missing.length === 0) return null;
  return (
    `EMAIL_SES_TENANTS is on but ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} ` +
    "not set. A tenant sends only with a configuration set associated, and tenants are managed " +
    "with the identity credential."
  );
}

/** The provider's sending status for a tenant. */
export type SesSendingStatus = "ENABLED" | "REINSTATED" | "DISABLED";

export interface SesTenant {
  name: string;
  /** `arn:<partition>:ses:<region>:<account>:tenant/<name>/<id>`. */
  arn: string;
  sendingStatus: SesSendingStatus | null;
}

type TenantCommand =
  | CreateTenantCommand
  | GetTenantCommand
  | CreateTenantResourceAssociationCommand
  | DeleteTenantResourceAssociationCommand
  | GetReputationEntityCommand;

type TenantOutput =
  | CreateTenantCommandOutput
  | GetTenantCommandOutput
  | CreateTenantResourceAssociationCommandOutput
  | DeleteTenantResourceAssociationCommandOutput
  | GetReputationEntityCommandOutput;

/** The subset of the SES client this module uses, so tests inject a fake. */
export interface SesTenantClient {
  send(command: TenantCommand): Promise<TenantOutput>;
}

export interface SesTenantDeps {
  client: SesTenantClient;
}

function defaultDeps(): SesTenantDeps {
  return { client: sesManagementClient().client };
}

/** A tenant call the provider answered with a failure. */
export class SesTenantError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SesTenantError";
  }
}

interface ShapedError {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  $metadata?: { httpStatusCode?: unknown };
}

function errorCode(error: unknown): string | null {
  const shaped = error as ShapedError;
  if (typeof shaped?.code === "string" && shaped.code !== "")
    return shaped.code;
  return typeof shaped?.name === "string" && shaped.name !== ""
    ? shaped.name
    : null;
}

function tenantFailure(
  error: unknown,
  action: string,
  tenant: string,
): SesTenantError {
  const shaped = error as ShapedError;
  const rawStatus = shaped?.$metadata?.httpStatusCode;
  const status = typeof rawStatus === "number" ? rawStatus : null;
  const code = errorCode(error);
  const detail =
    safeDetail(typeof shaped?.message === "string" ? shaped.message : null) ||
    `HTTP ${status ?? "unknown"}`;
  const retryable =
    status === null || status === 408 || status === 429 || status >= 500;
  const message =
    code === "AccessDeniedException"
      ? `SES refused ${action}. Grant ${action} to the identity credential ` +
        `(EMAIL_SES_IDENTITY_ACCESS_KEY_ID): ${detail}`
      : `SES ${action} failed: ${detail}`;
  log.warn({ status, code, action, tenant, detail }, "ses tenant call failed");
  return new SesTenantError(message, status, code, retryable);
}

function toTenant(
  name: string,
  tenant: { TenantArn?: string; SendingStatus?: string } | undefined,
): SesTenant {
  if (!tenant?.TenantArn) {
    throw new SesTenantError(
      "SES described a tenant without its ARN",
      null,
      null,
      true,
    );
  }
  return {
    name,
    arn: tenant.TenantArn,
    sendingStatus:
      (tenant.SendingStatus as SesSendingStatus | undefined) ?? null,
  };
}

/**
 * Create the tenant, or describe it when it already exists. Idempotent: a
 * retried reconcile, or two at once, both end with the one tenant.
 */
export async function ensureSesTenant(
  name: string,
  deps: SesTenantDeps = defaultDeps(),
): Promise<SesTenant> {
  try {
    const created = (await deps.client.send(
      new CreateTenantCommand({ TenantName: name }),
    )) as CreateTenantCommandOutput;
    log.info({ tenant: name }, "ses tenant created");
    return toTenant(name, created);
  } catch (error) {
    if (errorCode(error) !== "AlreadyExistsException") {
      throw tenantFailure(error, "ses:CreateTenant", name);
    }
  }
  try {
    const found = (await deps.client.send(
      new GetTenantCommand({ TenantName: name }),
    )) as GetTenantCommandOutput;
    return toTenant(name, found.Tenant);
  } catch (error) {
    if (error instanceof SesTenantError) throw error;
    throw tenantFailure(error, "ses:GetTenant", name);
  }
}

/** Associate a resource with the tenant. Already associated counts as done. */
export async function associateSesTenantResource(
  name: string,
  resourceArn: string,
  deps: SesTenantDeps = defaultDeps(),
): Promise<void> {
  try {
    await deps.client.send(
      new CreateTenantResourceAssociationCommand({
        TenantName: name,
        ResourceArn: resourceArn,
      }),
    );
  } catch (error) {
    if (errorCode(error) === "AlreadyExistsException") return;
    throw tenantFailure(error, "ses:CreateTenantResourceAssociation", name);
  }
}

/** Release a resource from the tenant. Not associated counts as done. */
export async function disassociateSesTenantResource(
  name: string,
  resourceArn: string,
  deps: SesTenantDeps = defaultDeps(),
): Promise<void> {
  try {
    await deps.client.send(
      new DeleteTenantResourceAssociationCommand({
        TenantName: name,
        ResourceArn: resourceArn,
      }),
    );
  } catch (error) {
    if (errorCode(error) === "NotFoundException") return;
    throw tenantFailure(error, "ses:DeleteTenantResourceAssociation", name);
  }
}

export interface SesTenantReputation {
  /** The combined status: disabled while either the operator's or the provider's is. */
  status: SesSendingStatus | null;
  /** Why it is paused, from whichever side paused it; null when sending. */
  cause: string | null;
}

/** Read the tenant's sending status and, when paused, why. */
export async function getSesTenantReputation(
  tenantArn: string,
  deps: SesTenantDeps = defaultDeps(),
): Promise<SesTenantReputation> {
  let response: GetReputationEntityCommandOutput;
  try {
    response = (await deps.client.send(
      new GetReputationEntityCommand({
        ReputationEntityType: "RESOURCE",
        ReputationEntityReference: tenantArn,
      }),
    )) as GetReputationEntityCommandOutput;
  } catch (error) {
    throw tenantFailure(error, "ses:GetReputationEntity", tenantArn);
  }
  const entity = response.ReputationEntity;
  const status =
    (entity?.SendingStatusAggregate as SesSendingStatus | undefined) ?? null;
  if (status !== "DISABLED") return { status, cause: null };
  const pausedBy = [
    entity?.AwsSesManagedStatus,
    entity?.CustomerManagedStatus,
  ].find((record) => record?.Status === "DISABLED");
  return { status, cause: safeDetail(pausedBy?.Cause) || null };
}

// ============================================================================
// Resource names. The account id is read off the tenant's own ARN, so no
// further call or credential is needed to name the resources beside it.
// ============================================================================

const TENANT_ARN = /^(arn:[a-z-]+:ses:[a-z0-9-]+:\d{12}):tenant\//;

/** `arn:<partition>:ses:<region>:<account>` from a tenant ARN, or null. */
export function sesArnPrefix(tenantArn: string): string | null {
  return TENANT_ARN.exec(tenantArn)?.[1] ?? null;
}

export function sesIdentityArn(prefix: string, identity: string): string {
  return `${prefix}:identity/${identity}`;
}

export function sesConfigurationSetArn(
  prefix: string,
  configurationSet: string,
): string {
  return `${prefix}:configuration-set/${configurationSet}`;
}
