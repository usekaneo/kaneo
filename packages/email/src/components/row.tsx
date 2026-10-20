import { Row as EmailRow } from "@react-email/components";
import React from "react";

void React;

type RowProps = React.ComponentProps<typeof EmailRow>;

export function Row({ align, style, ...props }: RowProps) {
  return (
    <EmailRow {...props} align={align} style={{ width: "100%", ...style }} />
  );
}
