import { InvitationCard } from "../../components/invitation-card";
import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";

import React from "react";
void React;
import { Link, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, utils } from "./shared-styles";

interface PortalInviteEmailProps {
  workspaceName: string;
  inviteLink: string;
  logoUrl?: string;
  personalMessage?: string;
}

export function PortalInviteEmail({
  workspaceName,
  inviteLink,
  logoUrl,
  personalMessage,
}: PortalInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You've been invited to access the ${workspaceName} portal`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      {/* Content */}
      <EmailIntro title="You've been invited!" />
      <Text className="k-text-85" style={typography.text}>
        You&apos;ve been invited to access the <strong>{workspaceName}</strong>{" "}
        portal. Click below to accept and sign in.
      </Text>

      {personalMessage && (
        <>
          <Frame title="A note from the team">
            <Text
              className="k-text-85"
              style={{
                ...typography.textSmall,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              {personalMessage}
            </Text>
          </Frame>
          <Spacer size={20} />
        </>
      )}

      {/* CTA Button */}
      <InvitationCard
        workspaceName={workspaceName}
        description="Share ideas and follow product updates with your team."
        cta="Accept invitation"
        href={inviteLink}
      />

      {/* Fallback Link */}
      <Text className="k-text-85" style={typography.textSmall}>
        Or copy and paste this link into your browser:{" "}
        <Link className="k-link" href={inviteLink} style={utils.link}>
          {inviteLink}
        </Link>
      </Text>

      {/* Footer */}
      <TransactionalFooter>
        If you weren&apos;t expecting this invitation, you can ignore this
        email.
      </TransactionalFooter>
    </EmailLayout>
  );
}
