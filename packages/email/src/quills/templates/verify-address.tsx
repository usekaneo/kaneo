import React from "react";
import { EmailIntro } from "../../components/email-intro";
import { EmailNote } from "../../components/email-note";
import { Frame } from "../../components/frame";
import { OtpCode } from "../../components/otp-code";
import { EmailLayout, TransactionalFooter } from "./email-layout";
void React;
interface VerifyAddressEmailProps {
  code: string;
  workspaceName?: string;
  logoUrl?: string;
}
export function VerifyAddressEmail({
  code,
  workspaceName,
  logoUrl,
}: VerifyAddressEmailProps) {
  const where = workspaceName ? ` for ${workspaceName}` : "";
  return (
    <EmailLayout preview={`Your verification code${where}`} logoUrl={logoUrl}>
      <EmailIntro
        title="Confirm your email"
        subtitle={`Enter this code${where} to confirm this address. It expires in 10 minutes.`}
      />
      <Frame title="Email verification">
        <OtpCode
          code={code}
          label="Your verification code"
          hint="Enter it in the app where you requested this change."
        />
      </Frame>
      <EmailNote title="Didn't ask for this?">
        Ignore this email. Nothing changes without the code.
      </EmailNote>
      <TransactionalFooter>
        You’re receiving this because someone entered this address on an
        account. It won’t be used for anything until it’s confirmed.
      </TransactionalFooter>
    </EmailLayout>
  );
}
