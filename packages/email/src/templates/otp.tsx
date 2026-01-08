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
        <Heading style={heading}>Your verification code</Heading>
        <Section style={body}>
          <Text style={paragraph}>Enter this code to sign in to Kaneo:</Text>
          <Text style={codeStyle}>{otp}</Text>
          <Text style={paragraph}>
            This code will only be valid for the next 5 minutes.
          </Text>
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
  fontSize: "16px",
  lineHeight: "26px",
};

const codeStyle = {
  fontSize: "32px",
  fontWeight: "bold",
  letterSpacing: "6px",
  textAlign: "center" as const,
  margin: "24px 0",
  padding: "16px",
  backgroundColor: "#f4f4f5",
  borderRadius: "8px",
};

const footerParagraph = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#6B7280",
};
