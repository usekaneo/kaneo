import React from "react";
import { EmailFooter } from "../components/email-footer";
import { EmailIntro } from "../components/email-intro";
import { EmailNote } from "../components/email-note";
import { EmailShell } from "../components/email-shell";
import { footerLinks } from "../components/footer-links";
import {
  type RequestContext,
  RequestDetails,
} from "../components/request-details";

void React;

// Only instance administrators receive this diagnostic, so it stays English.
export type TestEmailProps = Pick<
  RequestContext,
  "email" | "instance" | "requestedAt"
>;

const copy = {
  preview: "Outgoing email from your Kaneo instance is working.",
  title: "Your email settings work",
  subtitle:
    "An administrator sent this test from the System page. If you can read it, your Kaneo instance can deliver email.",
  noteTitle: "Nothing else to do",
  note: "You can delete this email. It contains no links and changes nothing in Kaneo.",
  footer: "Kaneo test email",
};

const TestEmail = ({ email, instance, requestedAt }: TestEmailProps) => (
  <EmailShell title={copy.title} preview={copy.preview} lang="en">
    <EmailIntro title={copy.title} subtitle={copy.subtitle} />
    <RequestDetails
      locale="en"
      email={email}
      instance={instance}
      requestedAt={requestedAt}
    />
    <EmailNote title={copy.noteTitle}>{copy.note}</EmailNote>
    <EmailFooter title={copy.footer} links={footerLinks("en")} />
  </EmailShell>
);

TestEmail.PreviewProps = {
  email: "maya@example.com",
  instance: "kaneo.example.com",
  requestedAt: "2026-10-26T09:30:00.000Z",
} as TestEmailProps;

export default TestEmail;
