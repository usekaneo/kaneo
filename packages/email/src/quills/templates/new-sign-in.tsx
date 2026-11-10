import { Frame } from "../../components/frame";
import { DetailRows } from "../../components/detail-rows";
import { Spacer } from "../../components/spacer";
import { EmailIntro } from "../../components/email-intro";
import React from "react";
void React;
import { Hr, Link, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, utils } from "./shared-styles";

interface NewSignInEmailProps {
  workspaceName?: string;
  occurredAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  location?: string | null;
  settingsUrl?: string | null;
  /** When true, skip the password CTA — the profile page hides PasswordForm. */
  ssoEnforced?: boolean;
  logoUrl?: string;
}

/**
 * "New device" sign-in notification — sent when an additional signed
 * device cookie is seen for the recipient's account. Browser/OS, IP
 * and location are shown as context; they are not the device identity.
 * The user is already signed in by the time this lands; the alert is
 * purely informational with a recovery path if it wasn't them.
 */
export function NewSignInEmail({
  workspaceName,
  occurredAt,
  ipAddress,
  userAgent,
  location,
  settingsUrl,
  ssoEnforced,
  logoUrl,
}: NewSignInEmailProps) {
  return (
    <EmailLayout
      preview="A new sign-in was detected on your account"
      logoUrl={logoUrl}
    >
      <EmailIntro title="New sign-in to your account" />
      <Text className="k-text-85" style={typography.text}>
        {workspaceName
          ? `Someone just signed in to your ${workspaceName} account on a device we haven't seen before.`
          : "Someone just signed in to your account on a device we haven’t seen before."}
      </Text>

      <Frame title="Sign-in details" panelPadding="8px 20px">
        <DetailRows
          rows={[
            { label: "When", value: occurredAt },
            ...(ipAddress ? [{ label: "IP address", value: ipAddress }] : []),
            ...(userAgent ? [{ label: "Device", value: userAgent }] : []),
            ...(location ? [{ label: "Location", value: location }] : []),
          ]}
        />
      </Frame>
      <Spacer size={24} />

      <Hr
        className="k-divider"
        style={{ margin: "24px 0", borderColor: "#EBEBEB" }}
      />

      <Text className="k-text-85" style={typography.text}>
        {ssoEnforced ? (
          "If that was you, no action needed. If it wasn’t, change your password at your identity provider and ask a workspace admin to sign out other sessions."
        ) : (
          <>
            If that was you, no action needed. If it wasn’t,{" "}
            {settingsUrl ? (
              <>
                <Link className="k-link" href={settingsUrl} style={utils.link}>
                  set or change your password
                </Link>{" "}
                from your profile settings. This signs out other sessions.
              </>
            ) : (
              "set or change your password from your profile settings. This signs out other sessions."
            )}
          </>
        )}
      </Text>

      <TransactionalFooter>
        You&apos;re receiving this because a new sign-in was detected on your
        account. These alerts are required and can&apos;t be disabled.
      </TransactionalFooter>
    </EmailLayout>
  );
}
