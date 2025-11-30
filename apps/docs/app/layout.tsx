import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kaneo.app"),
  title: {
    default: "Kaneo — All you need. Nothing you don't.",
    template: "%s",
  },
  description:
    "All you need. Nothing you don't. Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
  keywords: [
    "project management",
    "open source",
    "self-hosted",
    "kanban",
    "team collaboration",
    "task management",
    "time tracking",
    "gantt chart",
    "jira alternative",
    "asana alternative",
    "productivity",
    "docker",
  ],
  authors: [{ name: "Andrej Acevski" }],
  creator: "Andrej Acevski",
  publisher: "Kaneo",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kaneo.app",
    title: "Kaneo — All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    siteName: "Kaneo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaneo — All you need. Nothing you don't.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaneo — All you need. Nothing you don't.",
    description:
      "Open source project management that works for you, not against you. Self-hosted, simple, and powerful.",
    images: ["/og-image.png"],
    creator: "@usekaneo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://kaneo.app",
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "Kaneo Blog RSS Feed" },
      ],
    },
  },
  category: "technology",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="Kaneo" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          search={{
            options: {
              type: "static",
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
