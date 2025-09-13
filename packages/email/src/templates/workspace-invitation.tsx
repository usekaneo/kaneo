import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

export interface WorkspaceInvitationEmailProps {
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  invitationLink: string;
}

const logoUrl = "https://assets.kaneo.app/logo-main.png";

const WorkspaceInvitationEmail = ({
  workspaceName,
  inviterName,
  inviterEmail,
  invitationLink,
}: WorkspaceInvitationEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>You've been invited to join {workspaceName} on Kaneo.</Preview>
      <Container style={container}>
        <Container style={header}>
          <Img src={logoUrl} height={48} alt="Kaneo" />
        </Container>
        <Heading style={heading}>🎉 You're invited to {workspaceName}</Heading>
        <Section style={body}>
          <Text style={paragraph}>
            <strong>{inviterName}</strong> ({inviterEmail}) has invited you to
            join the <strong>{workspaceName}</strong> workspace on Kaneo.
          </Text>
          <Text style={paragraph}>
            <Link style={link} href={invitationLink}>
              👉 Accept invitation 👈
            </Link>
          </Text>
          <Text style={paragraph}>
            This invitation will expire in 7 days. If you don't have a Kaneo
            account yet, you'll be able to create one when you accept the
            invitation.
          </Text>
          <Text style={paragraph}>
            If you didn't expect this invitation, you can safely ignore this
            email.
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

const header = {
  display: "inline-block",
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

const link = {
  color: "#5463FF",
};

const footerParagraph = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6B7280",
};
