/**
 * Where the app tells the SES send which provider tenant a message goes under,
 * and hears back when that tenant is paused.
 *
 * This package knows nothing of workspaces, so the decision is the app's. It
 * installs one function that names the tenant for a send (or none) and one that
 * is told when the provider refuses a send because the tenant is paused. With
 * nothing installed every send is untenanted, which is every install that has
 * not turned tenants on.
 *
 * The auth rule is applied here, before the app is asked: a type that
 * {@link isTenantedEmailType} keeps untenanted never reaches the resolver, so no
 * resolver can put a sign-in link under a paused tenant.
 */
import { createLogger } from "@kaneo/logger";
import { isTenantedEmailType } from "./mail-class";

const log = createLogger({ base: { service_name: "quackback-email" } }).child({
  component: "email-ses-tenant",
});

export interface SesTenantSendContext {
  emailType: string;
  /** The From going on the wire, display name included. */
  from: string;
}

export interface SesTenantHooks {
  /** The tenant for this send, or null to send untenanted. */
  tenantFor: (ctx: SesTenantSendContext) => Promise<string | null>;
  /** The provider refused a send because this tenant is paused. */
  onTenantPaused: (tenantName: string, detail: string) => Promise<void>;
}

const hooks: { current: SesTenantHooks | null } = { current: null };

/** Installed by the app at boot; null removes them. */
export function setSesTenantHooks(next: SesTenantHooks | null): void {
  hooks.current = next;
}

/**
 * The tenant to send under, or undefined. Never throws: a resolver failure
 * sends untenanted, which is how the send behaved before tenants existed.
 */
export async function resolveSesTenant(
  ctx: SesTenantSendContext,
): Promise<string | undefined> {
  const current = hooks.current;
  if (!current || !isTenantedEmailType(ctx.emailType)) return undefined;
  try {
    return (await current.tenantFor(ctx)) ?? undefined;
  } catch (err) {
    log.warn(
      { err, email_type: ctx.emailType },
      "ses tenant lookup failed; sending untenanted",
    );
    return undefined;
  }
}

/** Tell the app a tenant is paused. Never throws: the send's own error is what propagates. */
export async function reportSesTenantPaused(
  tenantName: string,
  detail: string,
): Promise<void> {
  try {
    await hooks.current?.onTenantPaused(tenantName, detail);
  } catch (err) {
    log.warn(
      { err, tenant: tenantName },
      "recording a paused ses tenant failed",
    );
  }
}
