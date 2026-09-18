import React from "react";
import {
  ActionButtons,
  Callout,
  type Detail,
  DetailCard,
  type EmailAction,
  Paragraph,
  Quote,
} from "../../layout/components";
import { type EmailBrand, MotherLayout } from "../../layout/mother";
import type { Tone } from "../../layout/theme";

void React;

/**
 * Everything a notification email can show. The API's email catalog fills
 * this per event (task assigned, leave approved, …); the layout stays the same.
 */
export type ActivityEmailProps = {
  brand?: EmailBrand;
  preview: string;
  eyebrow?: string | null;
  heading: string;
  intro?: string | null;
  card?: {
    title?: string | null;
    subtitle?: string | null;
    details?: Detail[];
    status?: { label: string; tone: Tone } | null;
  } | null;
  quote?: { author?: string | null; text: string } | null;
  callout?: { tone?: Tone; text: string } | null;
  body?: string[] | null;
  primary?: EmailAction | null;
  secondary?: EmailAction | null;
  reason?: string | null;
  manageUrl?: string | null;
  manageLabel?: string;
};

const ActivityEmail = ({
  brand,
  preview,
  eyebrow,
  heading,
  intro,
  card,
  quote,
  callout,
  body,
  primary,
  secondary,
  reason,
  manageUrl,
  manageLabel,
}: ActivityEmailProps) => (
  <MotherLayout
    brand={brand}
    preview={preview}
    eyebrow={eyebrow}
    heading={heading}
    intro={intro}
    reason={reason}
    manageUrl={manageUrl}
    manageLabel={manageLabel}
  >
    {card ? <DetailCard {...card} /> : null}
    {quote ? <Quote {...quote} /> : null}
    {callout ? <Callout {...callout} /> : null}
    {body?.map((line) => (
      <Paragraph key={line}>{line}</Paragraph>
    ))}
    <ActionButtons
      primary={primary}
      secondary={secondary}
      accent={brand?.accent}
    />
  </MotherLayout>
);

ActivityEmail.PreviewProps = {
  brand: { name: "Demo Company", accent: "#4f46e5" },
  preview: "Nusrat asked for 2 days of annual leave",
  eyebrow: "Leave request",
  heading: "Nusrat Jahan asked for annual leave",
  intro: "Review the request and approve or reject it.",
  card: {
    title: "Annual leave",
    subtitle: "Sep 22 – Sep 23, 2026",
    status: { label: "Waiting for you", tone: "warning" },
    details: [
      { label: "Working days", value: "2" },
      { label: "Balance after", value: "14 of 18 days" },
    ],
  },
  quote: { author: "Nusrat Jahan", text: "Family event in Chattogram" },
  primary: { label: "Review request", url: "https://kaneo.app" },
  secondary: { label: "Open attendance", url: "https://kaneo.app" },
  reason: "You get this because you approve leave in Demo Company.",
  manageUrl: "https://kaneo.app",
} satisfies ActivityEmailProps;

export default ActivityEmail;
