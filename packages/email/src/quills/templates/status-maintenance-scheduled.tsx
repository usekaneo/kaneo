import { DetailRows } from "../../components/detail-rows";
import { EmailIntro } from "../../components/email-intro";
import { Frame } from "../../components/frame";
import { Spacer } from "../../components/spacer";
import { EmailButton } from "../../components/email-button";
import React from "react";
void React;
import { Text } from "@react-email/components";
import { EmailLayout, NotificationFooter } from "./email-layout";
import { typography } from "./shared-styles";
import { withLineBreaks } from "./line-breaks";

interface StatusMaintenanceScheduledEmailProps {
  workspaceName: string;
  maintenanceTitle: string;
  /** Plain text description of the maintenance. Its line breaks are kept. */
  body: string;
  /** Pre-formatted display string for the start of the maintenance window. */
  startLabel: string;
  /** Pre-formatted display string for the end of the maintenance window. */
  endLabel: string;
  /** Component names only (no status), since maintenance is scheduled ahead of impact. */
  affectedComponents: string[];
  incidentUrl: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

export function StatusMaintenanceScheduledEmail({
  workspaceName,
  maintenanceTitle,
  body,
  startLabel,
  endLabel,
  affectedComponents,
  incidentUrl,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: StatusMaintenanceScheduledEmailProps) {
  return (
    <EmailLayout
      footer={
        <NotificationFooter
          reason="You received this email because you're subscribed to status updates."
          unsubscribeUrl={unsubscribeUrl}
          unsubscribeLabel="Unsubscribe from status updates"
          preferencesUrl={preferencesUrl}
        />
      }
      preview={`Scheduled maintenance: ${maintenanceTitle} (${startLabel})`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      <EmailIntro
        title={maintenanceTitle}
        subtitle={`${workspaceName} has scheduled maintenance that may affect its services.`}
      />
      {body && (
        <Text className="k-text-85" style={typography.text}>
          {withLineBreaks(body)}
        </Text>
      )}
      <Frame title="Maintenance window" panelPadding="8px 20px">
        <DetailRows
          rows={[
            { label: "Starts", value: startLabel },
            { label: "Ends", value: endLabel },
          ]}
        />
      </Frame>
      <Spacer size={20} />
      {affectedComponents.length > 0 && (
        <>
          <Frame title="Affected services">
            <Text
              className="k-text-85"
              style={{ ...typography.text, margin: "0" }}
            >
              {affectedComponents.join(", ")}
            </Text>
          </Frame>
          <Spacer size={24} />
        </>
      )}
      <EmailButton href={incidentUrl}>View status page</EmailButton>
      <Spacer size={32} />
    </EmailLayout>
  );
}
