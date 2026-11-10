import { EmailIntro } from "../../components/email-intro";
import { EmailNote } from "../../components/email-note";
import React from "react";
void React;

import { EmailLayout, TransactionalFooter } from "./email-layout";

interface SignupNotAllowedEmailProps {
  workspaceName?: string;
  logoUrl?: string;
}

/**
 * Why no sign-in link arrived.
 *
 * The workspace refuses to open an account for this address, and the HTTP
 * response deliberately does not say so: an endpoint that answered differently
 * per address would tell any unauthenticated caller which addresses hold
 * accounts here. The inbox is the one channel that reaches only the person the
 * answer is about, so the refusal is delivered here instead.
 *
 * Carries no link and no code. There is nothing to grant, which is the point:
 * a message with no capability in it can be mailed to an address nobody has
 * proven they own.
 */
export function SignupNotAllowedEmail({
  workspaceName,
  logoUrl,
}: SignupNotAllowedEmailProps) {
  const where = workspaceName ? `${workspaceName}` : "this workspace";
  return (
    <EmailLayout
      preview="About your sign-in request"
      logoUrl={logoUrl}
      showPoweredBy={false}
    >
      <EmailIntro
        title="No account for this address"
        subtitle={`Someone asked for a sign-in link for this email address at ${where}.`}
      />
      <EmailNote title="What to do next">
        There is no account here for this address, and {where} is not accepting
        new accounts. Ask an admin to invite you, then sign in with the address
        they invite.
      </EmailNote>

      <TransactionalFooter>
        If you didn&apos;t request this, you can safely ignore this email. No
        account was created and nothing was changed.
      </TransactionalFooter>
    </EmailLayout>
  );
}
