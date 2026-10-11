import React from "react";
import { Badge } from "../components/badge";
import { DetailRows } from "../components/detail-rows";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { footerLinks } from "../components/footer-links";
import { type DateInput, formatDate } from "../components/format-date";
import { Frame } from "../components/frame";
import { InvitationCard } from "../components/invitation-card";
import { Spacer } from "../components/spacer";
import { resolveEmailLocale } from "./resolve-locale";

void React;

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  to: string;
  locale?: string | null;
  role?: string;
  expiresAt?: DateInput;
  instance?: string;
  copy?: WorkspaceInvitationEmailCopy;
};

export type WorkspaceInvitationEmailCopy = {
  subject: string;
  preview: string;
  title: string;
  subtitle: string;
  cta: string;
  sameEmail: string;
  ignore: string;
  footer: string;
  details?: {
    title: string;
    sentTo: string;
    instance: string;
    role: string;
    expires: string;
  };
};

const DEFAULT_COPY: WorkspaceInvitationEmailCopy = {
  subject: "{{inviterName}} invited you to join {{workspaceName}} on Kaneo",
  preview: "You're invited to {{workspaceName}} on Kaneo",
  title: "Join {{workspaceName}}",
  subtitle:
    "{{inviterName}} ({{inviterEmail}}) invited you to collaborate in Kaneo.",
  cta: "Accept invitation",
  sameEmail: "You can accept with the same email that received this message.",
  ignore: "If this wasn't expected, you can safely ignore this email.",
  footer: "Kaneo workspace invitation",
  details: {
    title: "Invitation details",
    sentTo: "Sent to",
    instance: "Instance",
    role: "Role",
    expires: "Expires",
  },
};

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
  locale,
  role,
  expiresAt,
  instance,
  copy = DEFAULT_COPY,
}: WorkspaceInvitationEmailProps) => {
  const values = { workspaceName, inviterName, inviterEmail };
  const lang = locale ?? "en";
  const details = copy.details;
  const detailRows = details
    ? [
        { label: details.sentTo, value: to },
        { label: details.instance, value: instance },
        { label: details.role, value: role ? <Badge>{role}</Badge> : null },
        {
          label: details.expires,
          value: expiresAt ? formatDate(expiresAt, lang) : undefined,
        },
      ].filter((row) => Boolean(row.value))
    : [];

  return (
    <EmailShell
      title={interpolate(copy.title, values)}
      preview={interpolate(copy.preview, values)}
      lang={lang}
    >
      <EmailIntro
        title={interpolate(copy.title, values)}
        subtitle={interpolate(copy.subtitle, values)}
      />
      <InvitationCard
        workspaceName={workspaceName}
        description={copy.sameEmail}
        cta={copy.cta}
        href={`${invitationLink}?email=${encodeURIComponent(to)}`}
      />
      {details && detailRows.length > 0 ? (
        <>
          <Spacer size={20} />
          <Frame title={details.title} panelPadding="8px 20px">
            <DetailRows rows={detailRows} />
          </Frame>
        </>
      ) : null}
      <EmailNote>{copy.ignore}</EmailNote>
      <EmailFooter
        title={copy.footer}
        links={footerLinks(resolveEmailLocale(locale))}
      />
    </EmailShell>
  );
};

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme",
  inviterName: "Sarah Chen",
  inviterEmail: "sarah@acme.com",
  invitationLink: "https://cloud.kaneo.app/invitation/accept/abc123",
  to: "maya@example.com",
  locale: "en-US",
  role: "Member",
  expiresAt: "2026-10-13T14:12:00.000Z",
  instance: "cloud.kaneo.app",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;
