import { Heading, Text } from "@react-email/components";
import React from "react";
import { Section } from "./section";
import { colors } from "./tokens";

void React;

type EmailNoteProps = {
  title?: string;
  children: React.ReactNode;
};

export function EmailNote({ title, children }: EmailNoteProps) {
  return (
    <Section style={wrapper}>
      {title ? (
        <Heading as="h2" className="k-text" style={heading}>
          {title}
        </Heading>
      ) : null}
      <Text className="k-subtle" style={body}>
        {children}
      </Text>
    </Section>
  );
}

const wrapper = {
  margin: "32px 0 40px",
};

const heading = {
  margin: "0 0 4px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "22px",
  fontWeight: "500",
};

const body = {
  margin: "0",
  maxWidth: "500px",
  color: "#525252",
  fontSize: "14px",
  lineHeight: "22px",
};
