import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailIntro } from "../../components/email-intro";
import React from "react";
void React;
import { Link, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, utils } from "./shared-styles";

/** The record whose check failed, as the settings page names it. */
export interface SendingDomainAttentionRecord {
  purpose: "ownership" | "dkim" | "mail-from";
  type: string;
  /** The full DNS name, e.g. `qb-bounce.acme.com`. */
  name: string;
  state: "missing" | "mismatch" | "proxied";
  /** What was found instead, for a mismatch. */
  seen?: string;
  /** A value the DNS host cut short or saved with its quote marks. */
  reason?: "truncated" | "quoted";
}

/**
 * What is wrong: the first listed record that failed its check, or
 * `signing-key` when every listed record looks right (or the key signing the
 * mail is not one of them) and signing still fails.
 */
export type SendingDomainAttentionProblem =
  | SendingDomainAttentionRecord
  | "signing-key";

export interface SendingDomainAttentionEmailProps {
  domain: string;
  /** What failed; absent when nothing more specific is known. */
  record?: SendingDomainAttentionProblem | null;
  settingsUrl?: string | null;
  workspaceName?: string;
  logoUrl?: string;
}

const PURPOSE_LABEL: Record<SendingDomainAttentionRecord["purpose"], string> = {
  ownership: "ownership record",
  dkim: "DKIM record",
  "mail-from": "return path record",
};

/** One sentence naming the record and what is wrong with it. */
export function sendingDomainProblem(
  domain: string,
  record: SendingDomainAttentionProblem | null | undefined,
): string {
  if (!record) return `The mail provider stopped confirming ${domain}.`;
  if (record === "signing-key")
    return `The signing key for ${domain} isn't working.`;
  const named = `The ${PURPOSE_LABEL[record.purpose]} (${record.type} ${record.name})`;
  if (record.state === "proxied")
    return `${named} is proxied. Turn off any proxy for it.`;
  if (record.state === "mismatch") {
    if (record.reason === "truncated")
      return `${named} was cut short by your DNS host.`;
    if (record.reason === "quoted")
      return `${named} has quote marks saved in its value.`;
    return record.seen
      ? `${named} has a different value: ${record.seen}.`
      : `${named} has a different value.`;
  }
  return `${named} is missing.`;
}

/**
 * Sent to the people who manage email channels when a verified sending domain
 * stops verifying, because from that moment replies leave from the default
 * address instead of the domain.
 */
export function SendingDomainAttentionEmail({
  domain,
  record,
  settingsUrl,
  workspaceName,
  logoUrl,
}: SendingDomainAttentionEmailProps) {
  const title = `Sending from ${domain} needs attention`;
  return (
    <EmailLayout preview={title} logoUrl={logoUrl}>
      <EmailIntro title={title} />
      <Frame title="Domain verification">
        <Text className="k-text-85" style={{ ...typography.text, margin: "0" }}>
          {sendingDomainProblem(domain, record)}
        </Text>
      </Frame>
      <Spacer size={24} />
      <Text className="k-text-85" style={typography.text}>
        Replies send from the default address until it is fixed.
      </Text>
      {settingsUrl ? (
        <Text className="k-text-85" style={typography.text}>
          <Link className="k-link" href={settingsUrl} style={utils.link}>
            Open email settings
          </Link>{" "}
          to see every record and verify.
        </Text>
      ) : null}
      <TransactionalFooter>
        You&apos;re receiving this because you manage email channels
        {workspaceName ? ` for ${workspaceName}` : ""}.
      </TransactionalFooter>
    </EmailLayout>
  );
}
