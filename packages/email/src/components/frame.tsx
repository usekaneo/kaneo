import { Heading, Text } from "@react-email/components";
import React from "react";
import { Section } from "./section";
import { colors, shadow } from "./tokens";

void React;

type FrameProps = {
  title: string;
  description?: string;
  panelPadding?: string;
  children: React.ReactNode;
};

export function Frame({
  title,
  description,
  panelPadding = "20px",
  children,
}: FrameProps) {
  return (
    <Section className="k-frame" style={frame}>
      <Section style={header}>
        <Heading as="h2" className="k-text" style={titleStyle}>
          {title}
        </Heading>
        {description ? (
          <Text className="k-muted" style={descriptionStyle}>
            {description}
          </Text>
        ) : null}
      </Section>
      <Section className="k-panel" style={{ ...panel, padding: panelPadding }}>
        {children}
      </Section>
    </Section>
  );
}

const frame = {
  borderRadius: "16px",
  backgroundColor: colors.frame,
  padding: "4px",
};

const header = {
  padding: "16px 20px",
};

const titleStyle = {
  margin: "0",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "600",
};

const descriptionStyle = {
  margin: "2px 0 0",
  color: colors.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
};

const panel = {
  borderRadius: "14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.border,
  backgroundColor: colors.background,
  boxShadow: shadow,
};
