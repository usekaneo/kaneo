import { Link, Text } from "@react-email/components";
import React from "react";
import { Section } from "./section";
import { colors } from "./tokens";

void React;

export type FooterLink = {
  label: string;
  href: string;
};

type EmailFooterProps = {
  title: string;
  reason?: string;
  links: FooterLink[];
};

export function EmailFooter({ title, reason, links }: EmailFooterProps) {
  return (
    <Section className="k-divider" style={wrapper}>
      <Text className="k-text" style={titleStyle}>
        {title}
      </Text>
      {reason ? (
        <Text className="k-muted" style={reasonStyle}>
          {reason}
        </Text>
      ) : null}
      <Text style={linksStyle}>
        {links.map((link, position) => (
          <React.Fragment key={link.href}>
            {position > 0 ? <span style={spacer}> </span> : null}
            <Link href={link.href} className="k-link" style={linkStyle}>
              {link.label}
            </Link>
          </React.Fragment>
        ))}
      </Text>
    </Section>
  );
}

const wrapper = {
  borderWidth: "1px 0 0",
  borderStyle: "solid",
  borderColor: colors.border,
  paddingTop: "24px",
};

const titleStyle = {
  margin: "0",
  color: colors.foreground,
  fontSize: "12px",
  lineHeight: "18px",
  fontWeight: "500",
};

const reasonStyle = {
  margin: "2px 0 0",
  maxWidth: "460px",
  color: colors.mutedForeground,
  fontSize: "12px",
  lineHeight: "18px",
};

const linksStyle = {
  margin: "8px 0 0",
  fontSize: "12px",
  lineHeight: "18px",
};

const spacer = {
  display: "inline-block",
  width: "16px",
};

const linkStyle = {
  color: colors.foreground,
  fontWeight: "500",
  textDecoration: "underline",
};
