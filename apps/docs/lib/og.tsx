import { ImageResponse } from "next/dist/compiled/@vercel/og";
import type { ImageResponseOptions } from "next/dist/compiled/@vercel/og/types";
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
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: "60px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Gradient Background */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          right: "-25%",
          width: "80%",
          height: "150%",
          background:
            "linear-gradient(to bottom right, rgb(99,102,241), rgb(129,140,248))",
          opacity: 0.15,
          borderRadius: "30%",
          transform: "rotate(-12deg)",
          filter: "blur(100px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "60px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "rgba(99,102,241,0.1)",
            padding: "12px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="24"
            height="24"
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
            fontSize: "24px",
            fontWeight: 600,
            color: primaryTextColor,
          }}
        >
          Kaneo
        </span>
      </div>

      {/* Content */}
      <div style={{ zIndex: 10, maxWidth: "80%" }}>
        <h1
          style={{
            fontSize: "64px",
            fontWeight: 600,
            color: primaryTextColor,
            lineHeight: 1.2,
            margin: 0,
            marginBottom: description ? "24px" : 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "32px",
              color: "rgb(161,161,170)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
