import React from "react";
import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { footerLinks } from "../components/footer-links";
import { type DateInput, formatShortDate } from "../components/format-date";
import { Frame } from "../components/frame";
import { Progress } from "../components/progress";
import { Spacer } from "../components/spacer";

void React;

export type TrialReminderEmailProps = {
  workspaceName: string;
  daysLeft: number;
  billingUrl: string;
  trialDays?: number;
  endsAt?: DateInput;
  email?: string;
};

function title(daysLeft: number) {
  if (daysLeft <= 0) {
    return "Your trial has ended";
  }
  if (daysLeft === 1) {
    return "Your trial ends tomorrow";
  }
  return `Your trial ends in ${daysLeft} days`;
}

function preview(workspaceName: string, daysLeft: number) {
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
  return "Choose a plan to keep creating and editing when the trial ends. Your projects, tasks and members stay exactly as they are.";
}

function remaining(daysLeft: number) {
  if (daysLeft <= 0) {
    return "Ended";
  }
  return daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
}

const TrialReminderEmail = ({
  workspaceName,
  daysLeft,
  billingUrl,
  trialDays = 14,
  endsAt,
  email,
}: TrialReminderEmailProps) => {
  const used = Math.min(trialDays, Math.max(0, trialDays - daysLeft));
  const endDate = endsAt ? formatShortDate(endsAt, "en") : undefined;

  return (
    <EmailShell
      title={title(daysLeft)}
      preview={preview(workspaceName, daysLeft)}
      lang="en"
    >
      <EmailIntro title={title(daysLeft)} subtitle={subtitle(daysLeft)} />
      <Frame
        title="Kaneo Cloud trial"
        description={
          endDate
            ? `${workspaceName} workspace, ends ${endDate}`
            : `${workspaceName} workspace`
        }
      >
        <Progress
          label={`${used} of ${trialDays} days used`}
          value={remaining(daysLeft)}
          percent={(used / trialDays) * 100}
        />
      </Frame>
      <Spacer size={20} />
      <EmailButton href={billingUrl} icon="credit-card-light">
        Choose a plan
      </EmailButton>
      <EmailNote title="Rather run it yourself?">
        Kaneo is free forever when you host it, with every feature included. You
        can export your data at any time and move it to your own server.
      </EmailNote>
      <EmailFooter
        title="Kaneo Cloud billing"
        reason={
          email
            ? `Sent to ${email} because you own the ${workspaceName} workspace on Kaneo Cloud.`
            : `You are receiving this because you own this workspace on Kaneo Cloud.`
        }
        links={footerLinks("en", [{ label: "Billing", href: billingUrl }])}
      />
    </EmailShell>
  );
};

TrialReminderEmail.PreviewProps = {
  workspaceName: "Acme",
  daysLeft: 3,
  billingUrl: "https://cloud.kaneo.app/dashboard/settings/workspace/billing",
  trialDays: 14,
  endsAt: "2026-10-14T00:00:00.000Z",
  email: "maya@example.com",
} as TrialReminderEmailProps;

export default TrialReminderEmail;
