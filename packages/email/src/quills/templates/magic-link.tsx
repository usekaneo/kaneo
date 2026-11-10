import React from "react";
import { EmailIntro } from "../../components/email-intro";
import { EmailButton } from "../../components/email-button";
import { EmailNote } from "../../components/email-note";
import { FallbackLink } from "../../components/fallback-link";
import { Frame } from "../../components/frame";
import { OtpCode } from "../../components/otp-code";
import { EmailLayout } from "./email-layout";
void React;

interface MagicLinkEmailProps {
  signInUrl: string;
  code: string;
  logoUrl?: string;
  workspaceName?: string;
}

export function MagicLinkEmail({
  signInUrl,
  code,
  logoUrl,
  workspaceName,
}: MagicLinkEmailProps) {
  const name = workspaceName?.trim();
  return (
    <EmailLayout preview="Your sign-in link" logoUrl={logoUrl}>
      <EmailIntro
        title={name ? `Sign in to ${name}` : "Sign in"}
        subtitle="Use the button below to finish signing in, or enter the code on the sign-in screen."
      />
      <EmailButton href={signInUrl}>Sign in</EmailButton>
      <FallbackLink
        label="Button not working? Paste this link into your browser:"
        href={signInUrl}
      />
      <Frame title="Sign-in code">
        <OtpCode
          code={code}
          label="Or enter this code on the sign-in screen:"
          hint="The link and code expire in 10 minutes."
        />
      </Frame>
      <EmailNote title="Didn't request this?">
        You can safely ignore this email. Never share this code or forward this
        link.
      </EmailNote>
    </EmailLayout>
  );
}
