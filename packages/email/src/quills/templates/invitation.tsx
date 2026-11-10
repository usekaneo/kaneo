import { FallbackLink } from "../../components/fallback-link";
import { InvitationCard } from "../../components/invitation-card";
import { EmailIntro } from "../../components/email-intro";

import React from "react";
void React;

import { EmailLayout, TransactionalFooter } from "./email-layout";

/** The invitation's words in the team's language, written by the caller. */
export interface InvitationEmailCopy {
  lang: string;
  dir: "ltr" | "rtl";
  preview: string;
  heading: string;
  body: string;
  cta: string;
  fallback: string;
  footer: string;
}

interface InvitationEmailProps {
  invitedByName: string;
  inviteeName?: string;
  organizationName: string;
  inviteLink: string;
  logoUrl?: string;
  /** Localised copy. Without it the email reads in English. */
  copy?: InvitationEmailCopy;
}

function englishCopy({
  invitedByName,
  inviteeName,
  organizationName,
}: Pick<
  InvitationEmailProps,
  "invitedByName" | "inviteeName" | "organizationName"
>) {
  const body = `${invitedByName} invited you to the ${organizationName} team.`;
  return {
    lang: "en",
    dir: "ltr" as const,
    preview: body,
    heading: inviteeName
      ? `Hi ${inviteeName}, join ${organizationName}`
      : `Join ${organizationName}`,
    body,
    cta: "Accept invitation",
    fallback: "Or paste this link into your browser:",
    footer: "Not expecting this? You can ignore this email.",
  };
}

export function InvitationEmail(props: InvitationEmailProps) {
  const { organizationName, inviteLink, logoUrl } = props;
  const copy = props.copy ?? englishCopy(props);
  return (
    <EmailLayout
      preview={copy.preview}
      logoUrl={logoUrl}
      logoAlt={organizationName}
      lang={copy.lang}
      dir={copy.dir}
    >
      <EmailIntro title={copy.heading} />

      <InvitationCard
        workspaceName={organizationName}
        description={copy.body}
        cta={copy.cta}
        href={inviteLink}
      />

      <FallbackLink label={copy.fallback} href={inviteLink} />

      <TransactionalFooter>{copy.footer}</TransactionalFooter>
    </EmailLayout>
  );
}
