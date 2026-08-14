import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { EmailShell, styles } from "./shell";

void React;

export type TrialReminderEmailProps = {
  workspaceName: string;
  daysLeft: number;
  billingUrl: string;
};

function title(workspaceName: string, daysLeft: number) {
  if (daysLeft <= 0) {
    return `The trial for ${workspaceName} has ended`;
  }
  if (daysLeft === 1) {
    return `1 day left on your ${workspaceName} trial`;
  }
  return `${daysLeft} days left on your ${workspaceName} trial`;
}

function subtitle(daysLeft: number) {
  if (daysLeft <= 0) {
    return "Your workspace is read-only until you choose a plan. Nothing has been deleted, and your data is still there.";
  }
  return "Choose a plan to keep creating and editing when the trial ends.";
}

const TrialReminderEmail = ({
  workspaceName,
  daysLeft,
  billingUrl,
}: TrialReminderEmailProps) => {
  return (
    <EmailShell
      preview={title(workspaceName, daysLeft)}
      title={title(workspaceName, daysLeft)}
      subtitle={subtitle(daysLeft)}
    >
      <Section>
        <Link style={styles.button} href={billingUrl}>
          Choose a plan
        </Link>
        <Text style={styles.paragraph}>
          Kaneo is also free forever if you host it yourself, with every feature
          included. You can export your data at any time and move it to your own
          server.
        </Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>
          You are receiving this because you own this workspace on Kaneo Cloud.
        </Text>
      </Section>
    </EmailShell>
  );
};

export default TrialReminderEmail;
