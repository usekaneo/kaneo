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

export type IncidentImpact = "none" | "minor" | "major" | "critical";

interface AffectedComponent {
  name: string;
  /** Humanized status label, e.g. "Degraded performance". */
  status: string;
}

interface StatusIncidentPublishedEmailProps {
  workspaceName: string;
  incidentTitle: string;
  impact: IncidentImpact;
  /** Humanized incident status, e.g. "Investigating". */
  statusLabel: string;
  /** Plain text of the first update. Its line breaks are kept. */
  body: string;
  affectedComponents: AffectedComponent[];
  incidentUrl: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
  logoUrl?: string;
}

const impactLabels: Record<IncidentImpact, string> = {
  none: "No impact",
  minor: "Minor impact",
  major: "Major impact",
  critical: "Critical impact",
};

export function StatusIncidentPublishedEmail({
  workspaceName,
  incidentTitle,
  impact,
  statusLabel,
  body,
  affectedComponents,
  incidentUrl,
  unsubscribeUrl,
  preferencesUrl,
  logoUrl,
}: StatusIncidentPublishedEmailProps) {
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
      preview={`${incidentTitle} (${statusLabel})`}
      logoUrl={logoUrl}
      logoAlt={workspaceName}
    >
      <EmailIntro
        title="New incident reported"
        subtitle={`${workspaceName} just posted an update to its status page.`}
      />
      <Frame title={incidentTitle} panelPadding="8px 20px">
        <DetailRows
          rows={[
            { label: "Impact", value: impactLabels[impact] },
            { label: "Status", value: statusLabel },
          ]}
        />
      </Frame>
      <Spacer size={20} />
      {body && (
        <>
          <Frame title="Latest update">
            <Text
              className="k-text-85"
              style={{ ...typography.text, margin: "0" }}
            >
              {withLineBreaks(body)}
            </Text>
          </Frame>
          <Spacer size={20} />
        </>
      )}
      {affectedComponents.length > 0 && (
        <>
          <Frame title="Affected services" panelPadding="8px 20px">
            <DetailRows
              rows={affectedComponents.map((component) => ({
                label: component.name,
                value: component.status,
              }))}
            />
          </Frame>
          <Spacer size={24} />
        </>
      )}
      <EmailButton href={incidentUrl}>View live status</EmailButton>
      <Spacer size={32} />
    </EmailLayout>
  );
}
