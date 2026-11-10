import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import React from "react";
void React;
import { Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

interface MessengerInstallEmailProps {
  senderName: string;
  workspaceName: string;
  snippet: string;
  logoUrl?: string;
}

/** A teammate asks whoever edits the website to add Messenger. */
export function MessengerInstallEmail({
  senderName,
  workspaceName,
  snippet,
  logoUrl,
}: MessengerInstallEmailProps) {
  return (
    <EmailLayout
      preview={`Add ${workspaceName} Messenger to the website`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      <EmailIntro title="Add Messenger to the website" />
      <Text className="k-text-85" style={typography.text}>
        <strong>{senderName}</strong> asked you to put {workspaceName}&apos;s
        Messenger on the website. Paste this code before the closing body tag on
        every page.
      </Text>
      <>
        <Frame title="Installation code">
          <Text className="k-text-85" style={codeText}>
            {snippet}
          </Text>
        </Frame>
        <Spacer size={20} />
      </>
      <Text className="k-text-85" style={typography.textSmall}>
        Using Google Tag Manager? Create a Custom HTML tag with the same code
        and trigger it on All pages.
      </Text>
      <TransactionalFooter>
        {senderName} will see Messenger connect as soon as it loads on the site.
      </TransactionalFooter>
    </EmailLayout>
  );
}

const codeText = {
  color: colors.text,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
  lineHeight: "18px",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-all" as const,
  overflowWrap: "anywhere" as const,
  margin: "0",
};
