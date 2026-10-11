import { Section as EmailSection } from "@react-email/components";
import React from "react";

void React;

type SectionProps = React.ComponentProps<typeof EmailSection>;

export function Section({ align, style, ...props }: SectionProps) {
  return (
    <EmailSection
      {...props}
      align={align}
      style={{ width: "100%", ...style }}
    />
  );
}
