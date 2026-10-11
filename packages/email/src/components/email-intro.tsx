import { Heading, Text } from "@react-email/components";
import React from "react";
import { colors } from "./tokens";

void React;

type EmailIntroProps = {
  title: string;
  subtitle?: string;
};

export function EmailIntro({ title, subtitle }: EmailIntroProps) {
  return (
    <>
      <Heading as="h1" className="k-text" style={heading}>
        {title}
      </Heading>
      {subtitle ? (
        <Text className="k-subtle" style={subtitleText}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );
}

const heading = {
  margin: "0 0 10px",
  color: colors.foreground,
  fontSize: "24px",
  lineHeight: "32px",
  fontWeight: "600",
  letterSpacing: "-0.6px",
};

const subtitleText = {
  margin: "0 0 28px",
  color: "#525252",
  fontSize: "14px",
  lineHeight: "22px",
};
