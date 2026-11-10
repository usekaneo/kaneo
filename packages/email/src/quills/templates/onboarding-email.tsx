import { EmailIntro } from "../../components/email-intro";
import { EmailButton } from "../../components/email-button";
import { EmailFooter } from "../../components/email-footer";
import { Frame } from "../../components/frame";
import React from "react";
void React;
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout } from "./email-layout";
import { typography, utils } from "./shared-styles";

/**
 * The setup emails' content, already written in the recipient's language by
 * the caller. The template only lays it out, so every language reads the same.
 */
export interface OnboardingEmailContent {
  /** BCP-47 language of the copy, e.g. "de" or "pt-BR". */
  lang: string;
  dir: "ltr" | "rtl";
  preview: string;
  heading: string;
  paragraphs: string[];
  /** The public link to share, shown on its own so it can be copied. */
  share?: { label: string; url: string; text: string } | null;
  cta: { label: string; url: string };
  /** A quieter second action under the button. */
  secondary?: { lead: string; label: string; url: string } | null;
  footer: { reason: string; unsubscribeLabel: string };
}

export interface OnboardingEmailProps extends OnboardingEmailContent {
  workspaceName: string;
  unsubscribeUrl: string;
  logoUrl?: string;
}

/** The ready email and the day-two nudge: one short message, one action. */
export function OnboardingEmail({
  lang,
  dir,
  preview,
  heading,
  paragraphs,
  share,
  cta,
  secondary,
  footer,
  workspaceName,
  unsubscribeUrl,
  logoUrl,
}: OnboardingEmailProps) {
  return (
    <EmailLayout
      footer={
        <EmailFooter
          title={footer.reason}
          links={[{ label: footer.unsubscribeLabel, href: unsubscribeUrl }]}
        />
      }
      preview={preview}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
      lang={lang}
      dir={dir}
    >
      <EmailIntro title={heading} />
      {paragraphs.map((paragraph) => (
        <Text className="k-text-85" key={paragraph} style={typography.text}>
          {paragraph}
        </Text>
      ))}
      {share ? (
        <Frame title={share.label}>
          <Text className="k-text-85" style={shareLink}>
            <Link className="k-link" href={share.url} style={utils.link}>
              {share.text}
            </Link>
          </Text>
        </Frame>
      ) : null}
      <Section style={{ textAlign: "start", margin: "24px 0" }}>
        <EmailButton href={cta.url}>{cta.label}</EmailButton>
      </Section>
      {secondary ? (
        <Text className="k-text-85" style={typography.textSmall}>
          {secondary.lead}{" "}
          <Link className="k-link" href={secondary.url} style={utils.link}>
            {secondary.label}
          </Link>
        </Text>
      ) : null}
    </EmailLayout>
  );
}

const shareLink = {
  fontSize: "15px",
  fontWeight: "600" as const,
  lineHeight: "22px",
  margin: "0",
  // A URL reads left to right in every language.
  direction: "ltr" as const,
  unicodeBidi: "isolate" as const,
};
