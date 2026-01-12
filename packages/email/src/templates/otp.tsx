import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

void React;

export type OtpEmailProps = {
  otp: string;
};

const OtpEmail = ({ otp }: OtpEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>Your verification code for Kaneo</Preview>
      <Container style={container}>
        <Heading style={heading}>
          <strong>Your login code for Kaneo is:</strong>
        </Heading>
        <Section style={body}>
          <Text style={codeStyle}>{otp}</Text>
          <Text style={paragraph}>The code is valid for 15 minutes.</Text>
          <Text style={paragraph}>
            If you didn't request this, please ignore this email.
          </Text>
          <Hr />
          <Text style={footerParagraph}>Kaneo</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

OtpEmail.PreviewProps = {
  otp: "123456",
} as OtpEmailProps;

export default OtpEmail;

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
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "12px 0",
  color: "#666",
};

const codeStyle = {
  fontSize: "30px",
  fontWeight: "bold" as const,
  letterSpacing: "4px",
  textAlign: "center" as const,
  margin: "12px 0",
  color: "#333",
};

const footerParagraph = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6B7280",
};
