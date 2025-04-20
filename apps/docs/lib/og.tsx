import type { ImageResponseOptions } from "next/dist/compiled/@vercel/og/types";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

interface GenerateProps {
  title: ReactNode;
  description?: ReactNode;
  primaryTextColor?: string;
  site?: string;
}

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
        alignItems: "center",
        padding: "80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient Background */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          right: "-20%",
          width: "100%",
          height: "160%",
          background:
            "linear-gradient(135deg, rgb(99,102,241) 0%, rgb(129,140,248) 100%)",
          opacity: 0.12,
          borderRadius: "30%",
          transform: "rotate(-12deg)",
          filter: "blur(120px)",
        }}
      />

      {/* Secondary Gradient */}
      <div
        style={{
          position: "absolute",
          bottom: "-40%",
          left: "-20%",
          width: "80%",
          height: "140%",
          background:
            "linear-gradient(225deg, rgb(99,102,241) 0%, rgb(129,140,248) 100%)",
          opacity: 0.08,
          borderRadius: "30%",
          transform: "rotate(12deg)",
          filter: "blur(120px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          left: "80px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "rgba(99,102,241,0.1)",
            padding: "16px",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
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
            <title>Kaneo Logo</title>
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
        </div>
        <span
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: primaryTextColor,
            opacity: 0.9,
          }}
        >
          Kaneo
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          zIndex: 10,
          maxWidth: "85%",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <h1
          style={{
            fontSize: description ? "72px" : "82px",
            fontWeight: 700,
            background:
              "linear-gradient(to right, rgb(255,255,255), rgb(228,228,231))",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "36px",
              color: "rgb(161,161,170)",
              margin: 0,
              lineHeight: 1.4,
              fontWeight: 400,
              opacity: 0.9,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
