import { Text } from "@react-email/components";
import React from "react";

void React;

type SpacerProps = {
  size: number;
};

export function Spacer({ size }: SpacerProps) {
  return (
    <Text
      aria-hidden="true"
      style={{ margin: "0", fontSize: "1px", lineHeight: `${size}px` }}
    >
      &nbsp;
    </Text>
  );
}
