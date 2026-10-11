import {
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
} from "@react-email/components";
import React from "react";
import { emailAsset } from "./assets";
import { themeCss } from "./theme";
import { colors, fontFamily } from "./tokens";

void React;

type EmailShellProps = {
  title: string;
  preview: string;
  lang: string;
  children: React.ReactNode;
};

export function EmailShell({
  title,
  preview,
  lang,
  children,
}: EmailShellProps) {
  return (
    <Html lang={lang} dir="ltr">
      <Head>
        <title>{title}</title>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{themeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <body className="k-bg" style={body}>
        <div
          role="article"
          aria-roledescription="email"
          aria-label={title}
          lang={lang}
          dir="ltr"
          className="k-bg"
          style={page}
        >
          <Container style={container}>
            <Row style={brand}>
              <Column style={markCell}>
                <Img
                  src={emailAsset("mark")}
                  width="28"
                  height="28"
                  alt=""
                  style={mark}
                />
              </Column>
              <Column className="k-text" style={wordmark}>
                Kaneo
              </Column>
            </Row>
            {children}
          </Container>
        </div>
      </body>
    </Html>
  );
}

const page = {
  backgroundColor: colors.background,
};

const body = {
  margin: "0",
  padding: "0",
  backgroundColor: colors.background,
  color: colors.foreground,
  fontFamily,
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "48px 24px 56px",
};

const brand = {
  marginBottom: "40px",
};

const markCell = {
  width: "38px",
  verticalAlign: "middle" as const,
};

const mark = {
  display: "block",
  border: "0",
  borderRadius: "7px",
};

const wordmark = {
  verticalAlign: "middle" as const,
  color: colors.foreground,
  fontSize: "19px",
  lineHeight: "28px",
  fontWeight: "600",
  letterSpacing: "-0.4px",
};
