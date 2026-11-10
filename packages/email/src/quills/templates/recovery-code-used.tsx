import { Frame } from "../../components/frame";
import { DetailRows } from "../../components/detail-rows";
import { Spacer } from "../../components/spacer";
import React from "react";
void React;
import { Heading, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography } from "./shared-styles";

interface RecoveryCodeUsedEmailProps {
  workspaceName?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt: string;
  logoUrl?: string;
}

/**
 * Security alert sent after a recovery code is consumed. Mirrors the
 * "new sign-in from unrecognised device" pattern most platforms send
 * — the recipient is the one whose code was used, so the email is
 * their canary against unauthorised access.
 */
export function RecoveryCodeUsedEmail({
  workspaceName,
  ipAddress,
  userAgent,
  occurredAt,
  logoUrl,
}: RecoveryCodeUsedEmailProps) {
  const workspaceLabel = workspaceName ? ` for ${workspaceName}` : "";
  return (
    <EmailLayout
      preview={`A recovery code was used to sign in${workspaceLabel}`}
      logoUrl={logoUrl}
    >
      <Heading
        className="k-text"
        style={{ ...typography.h1, textAlign: "start" }}
      >
        A recovery code was used
      </Heading>
      <Text
        className="k-text-85"
        style={{ ...typography.text, textAlign: "start" }}
      >
        Someone signed in to your account{workspaceLabel} using one of your
        saved recovery codes.
      </Text>

      <Frame title="Sign-in details" panelPadding="8px 20px">
        <DetailRows
          rows={[
            { label: "When", value: occurredAt },
            ...(ipAddress ? [{ label: "IP address", value: ipAddress }] : []),
            ...(userAgent ? [{ label: "Device", value: userAgent }] : []),
          ]}
        />
      </Frame>
      <Spacer size={24} />

      <Text className="k-text-85" style={typography.text}>
        If this was you, no action is needed. The code is now spent and
        can&apos;t be reused.
      </Text>
      <Text className="k-text-85" style={typography.text}>
        If this wasn&apos;t you, sign in and rotate your recovery codes
        immediately. The person who used the code now has an active session.
        Revoke it from your security settings.
      </Text>

      <TransactionalFooter>
        You&apos;re receiving this because a recovery code on your account was
        just used. These alerts are required and can&apos;t be disabled.
      </TransactionalFooter>
    </EmailLayout>
  );
}
