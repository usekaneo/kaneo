import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Column, Row, Section, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

interface WelcomeEmailProps {
  name: string;
  workspaceName: string;
  dashboardUrl: string;
  logoUrl?: string;
}

export function WelcomeEmail({
  name,
  workspaceName,
  dashboardUrl,
  logoUrl,
}: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview={`Welcome to ${workspaceName} on Quills`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      {/* Content */}
      <EmailIntro title="Welcome to Quills!" />
      <Text className="k-text-85" style={typography.text}>
        Hi {name}, your workspace <strong>{workspaceName}</strong> is ready.
        Start collecting and managing customer feedback today.
      </Text>

      {/* Features List - using Row/Column instead of spans for email compatibility */}
      <>
        <Frame title="Get started">
          {[
            "Create feedback boards",
            "Invite your team",
            "Share your public roadmap",
            "Connect GitHub, Slack & Discord",
          ].map((feature) => (
            <Row key={feature} style={{ marginBottom: "4px" }}>
              <Column style={{ width: "28px", verticalAlign: "top" }}>
                <Text className="k-text-85" style={checkIcon}>
                  &#10003;
                </Text>
              </Column>
              <Column>
                <Text className="k-text-85" style={featureText}>
                  {feature}
                </Text>
              </Column>
            </Row>
          ))}
        </Frame>
        <Spacer size={20} />
      </>

      {/* CTA Button */}
      <Section style={{ textAlign: "start", marginBottom: "32px" }}>
        <EmailButton href={dashboardUrl}>Go to Dashboard</EmailButton>
      </Section>

      {/* Footer */}
      <TransactionalFooter>
        Happy collecting!
        <br />
        The Quills Team
      </TransactionalFooter>
    </EmailLayout>
  );
}

const checkIcon = {
  color: colors.primary,
  fontSize: "15px",
  fontWeight: "700" as const,
  lineHeight: "28px",
  marginTop: "0",
  marginBottom: "0",
};

const featureText = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "28px",
  marginTop: "0",
  marginBottom: "0",
};
