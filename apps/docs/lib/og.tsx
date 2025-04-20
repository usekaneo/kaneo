import { readFileSync } from "node:fs";
import type { ImageResponseOptions } from "next/dist/compiled/@vercel/og/types";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

interface GenerateProps {
  title: ReactNode;
  description?: ReactNode;
  primaryTextColor?: string;
  site?: string;
}

const font = readFileSync("./lib/Inter_18pt-Regular.ttf");
const fontBold = readFileSync("./lib/Inter_18pt-Bold.ttf");

export function generateOgImage(options: GenerateProps & ImageResponseOptions) {
  const { title, description, primaryTextColor, ...rest } = options;

  return new ImageResponse(
    generate({
      title,
      description,
      primaryTextColor,
    }),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: font,
          weight: 400,
        },
        {
          name: "Inter",
          data: fontBold,
          weight: 700,
        },
      ],
      headers: new Headers({
        path: "/docs-og",
      }),
      ...rest,
    },
  );
}

function generate(options: GenerateProps): ReactElement {
  const { title, description, primaryTextColor = "rgb(255,255,255)" } = options;

  return (
    <div
      style={{
        background: "rgb(9,9,11)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient Background */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "120%",
          height: "140%",
          background:
            "linear-gradient(135deg, rgb(99,102,241) 0%, rgb(129,140,248) 100%)",
          opacity: 0.15,
          transform: "rotate(-12deg)",
          filter: "blur(140px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          zIndex: 10,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
        <h1
          style={{
            fontSize: "120px",
            fontWeight: 800,
            color: primaryTextColor,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            margin: 0,
            fontFamily: "Inter",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "48px",
              color: "rgb(161,161,170)",
              margin: 0,
              lineHeight: 1.3,
              fontWeight: 400,
              maxWidth: "90%",
              fontFamily: "Inter",
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          zIndex: 10,
          background: "rgba(99,102,241,0.1)",
          padding: "16px 24px",
          borderRadius: "16px",
          width: "auto",
        }}
      >
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: It goes over the logo */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgb(99,102,241)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
        <span
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: primaryTextColor,
            opacity: 0.9,
            fontFamily: "Inter",
          }}
        >
          Kaneo
        </span>
      </div>
    </div>
  );
}
