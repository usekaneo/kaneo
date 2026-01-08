import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

void React;

export type WorkspaceInvitationEmailProps = {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
  to: string;
};

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
  to,
}: WorkspaceInvitationEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>You've been invited to join {workspaceName} on Kaneo.</Preview>
      <Container style={container}>
        <Heading style={heading}>Join {workspaceName}</Heading>
        <Section style={body}>
          <Text style={paragraph}>
            {inviterName} ({inviterEmail}) has invited you to join{" "}
            {workspaceName} on Kaneo.
          </Text>
          <Text style={paragraph}>
            Click the button below to accept the invitation:
          </Text>
          <Link style={buttonStyle} href={`${invitationLink}?email=${to}`}>
            Accept Invitation
          </Link>
          <Text style={paragraph}>
            If you didn't expect this invitation, you can ignore this email.
          </Text>
          <Hr />
          <Text style={footerParagraph}>Kaneo</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

WorkspaceInvitationEmail.PreviewProps = {
  workspaceName: "Acme Inc",
  inviterName: "John Doe",
  inviterEmail: "john@acme.com",
  invitationLink: "https://kaneo.app/invite/abc123",
  to: "invitee@example.com",
} as WorkspaceInvitationEmailProps;

export default WorkspaceInvitationEmail;

const main = {
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 25px 0px",
};

const heading = {
  fontSize: "28px",
  fontWeight: "bold",
};

const body = {
  margin: "24px 0",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};

const buttonStyle = {
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  textAlign: "center" as const,
  textDecoration: "none",
  padding: "12px 24px",
  margin: "24px 0",
  backgroundColor: "#18181b",
  color: "#ffffff",
  borderRadius: "8px",
};

const footerParagraph = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6B7280",
};
