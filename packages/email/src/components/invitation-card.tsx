import { Heading, Text } from "@react-email/components";
import React from "react";
import { Section } from "./section";
import { EmailButton } from "./email-button";
import { ThemedImg } from "./themed-img";
import { colors, shadow } from "./tokens";

void React;

type InvitationCardProps = {
  workspaceName: string;
  description: string;
  cta: string;
  href: string;
};

export function InvitationCard({
  workspaceName,
  description,
  cta,
  href,
}: InvitationCardProps) {
  return (
    <Section className="k-card" style={card}>
      <div style={iconWrap}>
        <ThemedImg name="users-circle" width={48} height={48} />
      </div>
      <Heading as="h2" className="k-text" style={name}>
        {workspaceName}
      </Heading>
      <Text className="k-muted" style={descriptionStyle}>
        {description}
      </Text>
      <EmailButton href={href} icon="check-circle-light" fullWidth>
        {cta}
      </EmailButton>
    </Section>
  );
}

const card = {
  borderRadius: "16px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.border,
  backgroundColor: colors.background,
  boxShadow: shadow,
  padding: "24px",
  textAlign: "center" as const,
};

const iconWrap = {
  margin: "0 0 16px",
  lineHeight: "0",
};

const name = {
  margin: "0 0 12px",
  color: colors.foreground,
  fontSize: "18px",
  lineHeight: "28px",
  fontWeight: "600",
};

const descriptionStyle = {
  margin: "0 0 24px",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};
