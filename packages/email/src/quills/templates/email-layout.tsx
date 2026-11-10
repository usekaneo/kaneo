import { EmailNote } from "../../components/email-note";
import React from "react";
import { Text, Link } from "@react-email/components";
import { EmailShell } from "../../components/email-shell";
import { EmailFooter } from "../../components/email-footer";

import { typography, utils, colors } from "./shared-styles";
import { useEmailShowPoweredBy } from "../powered-by";

void React;

interface EmailLayoutProps {
  preview: string;
  logoUrl?: string;
  logoAlt?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Override the process-wide Powered-by flag. Capability-free templates
   * (no link, no code, no token) pass false so the footer cannot add an anchor.
   */
  showPoweredBy?: boolean;
  /** Language of the email's copy (BCP-47), for screen readers and mail clients. */
  lang?: string;
  /** Text direction of the copy; `rtl` lays the email out right to left. */
  dir?: "ltr" | "rtl";
}

export function EmailLayout({
  preview,
  logoUrl,
  logoAlt = "Quills",
  children,
  footer,
  showPoweredBy: showPoweredByOverride,
  lang,
  dir,
}: EmailLayoutProps) {
  const fromContext = useEmailShowPoweredBy();
  const showPoweredBy = showPoweredByOverride ?? fromContext;
  return (
    <EmailShell
      title={preview}
      preview={preview}
      lang={lang ?? "en"}
      dir={dir}
      brandName={logoAlt}
      logoUrl={logoUrl}
      logoAlt={logoAlt}
    >
      {children}
      {footer}
      {showPoweredBy ? (
        <Text
          className="k-muted"
          style={{
            ...typography.footer,
            borderTop: footer ? undefined : `1px solid ${colors.border}`,
            paddingTop: "24px",
          }}
        >
          <Link href="https://quills.io" className="k-link" style={utils.link}>
            Powered by Quills
          </Link>
        </Text>
      ) : null}
    </EmailShell>
  );
}

export function TransactionalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmailNote>{children}</EmailNote>;
}

export function NotificationFooter({
  reason,
  unsubscribeUrl,
  unsubscribeLabel = "Unsubscribe from this post",
  preferencesUrl,
}: {
  reason: string;
  unsubscribeUrl: string;
  unsubscribeLabel?: string;
  preferencesUrl?: string;
}) {
  return (
    <EmailFooter
      title="Notification preferences"
      reason={reason}
      links={[
        { label: unsubscribeLabel, href: unsubscribeUrl },
        ...(preferencesUrl
          ? [{ label: "Manage notification preferences", href: preferencesUrl }]
          : []),
      ]}
    />
  );
}
