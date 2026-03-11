import { Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type OtpEmailProps = {
  otp: string;
};

const OtpEmail = ({ otp }: OtpEmailProps) => (
  <EmailShell
    preview="Your Kaneo verification code"
    title="Your verification code"
    subtitle="Enter this one-time code to finish signing in."
  >
    <Section>
      <Text style={styles.paragraph}>
        {otp} is your Kaneo verification code.
      </Text>
      <Text style={styles.code}>{otp}</Text>
      <Text style={styles.paragraph}>This code expires in 15 minutes.</Text>
      <Text style={styles.muted}>
        If you didn't request this, you can ignore this email.
      </Text>
      <Section style={styles.divider} />
      <Text style={styles.footer}>Kaneo security email</Text>
    </Section>
  </EmailShell>
);

OtpEmail.PreviewProps = {
  otp: "123456",
} as OtpEmailProps;

export default OtpEmail;
