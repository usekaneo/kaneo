import { Frame } from "../../components/frame";
import { EmailIntro } from "../../components/email-intro";
import React from "react";
void React;
import { Column, Link, Row, Text } from "@react-email/components";
import { EmailLayout, TransactionalFooter } from "./email-layout";
import { typography, colors } from "./shared-styles";

/**
 * The 5 CSAT rating faces, in order (worst to best) — mirrors CSAT_FACES
 * (packages/db/src/types.ts) and the widget's block-affordance.tsx rendering
 * of a request_csat block. Duplicated as a plain literal rather than
 * imported: this package has no dependency on @quackback/db, and 5 emoji
 * aren't worth introducing one for. Exported (not just module-local) so
 * apps/web can assert deep equality against packages/db's own CSAT_FACES in
 * a parity test — a literal this easy to hand-edit in only one place is
 * exactly the kind of drift that needs a CI trip-wire, not just a comment.
 */
export const CSAT_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

interface CsatRequestEmailProps {
  /** The workflow block's own prompt text (plain text — the block body
   *  resolved server-side, never a raw template). */
  promptText: string;
  /** One rating link per face, in the same order as CSAT_FACES (index 0 =
   *  rating 1). All 5 share one signed token; only the `rating` query param
   *  differs per link. */
  ratingUrls: readonly [string, string, string, string, string];
  workspaceName: string;
  logoUrl?: string;
}

export function CsatRequestEmail({
  promptText,
  ratingUrls,
  workspaceName,
  logoUrl,
}: CsatRequestEmailProps) {
  const heading = "How did we do?";
  return (
    <EmailLayout preview={heading} logoUrl={logoUrl} logoAlt={workspaceName}>
      <EmailIntro title={heading} />
      {promptText && (
        <Text className="k-text-85" style={typography.text}>
          {promptText}
        </Text>
      )}

      <Frame title="Rate your conversation">
        <Row>
          {CSAT_FACES.map((face, i) => (
            <Column key={face} align="center">
              <Link
                className="k-link"
                href={ratingUrls[i]}
                style={{
                  display: "inline-block",
                  fontSize: "32px",
                  lineHeight: "40px",
                  textDecoration: "none",
                }}
              >
                {face}
              </Link>
            </Column>
          ))}
        </Row>
      </Frame>

      <Text
        className="k-text-85"
        style={{
          ...typography.textSmall,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        Click a face above to rate your experience.
      </Text>

      <TransactionalFooter>
        You received this email because you had a conversation with{" "}
        {workspaceName}.
      </TransactionalFooter>
    </EmailLayout>
  );
}
