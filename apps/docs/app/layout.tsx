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
    default: "Kaneo - Project management made simple",
    template: "%s",
  },
  description:
    "Free open source project management software for teams. Self-hosted alternative to Jira, Asana & Monday.com. Features kanban boards, time tracking, Gantt charts, and team collaboration. Docker deployment in 5 minutes.",
  keywords: [
    "free open source project management software",
    "open source project management",
    "free project management software",
    "self-hosted project management",
    "project management alternative",
    "kanban board software",
    "agile project management",
    "team collaboration software",
    "task management software",
    "project tracking software",
    "gantt chart software",
    "time tracking software",
    "scrum project management",
    "docker project management",
    "jira alternative",
    "asana alternative",
    "monday.com alternative",
    "trello alternative",
    "productivity software",
    "development team tools",
    "project planning software",
    "issue tracking software",
    "postgresql",
    "typescript",
    "react",
    "nextjs",
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
    title: "Kaneo - Project management made simple",
    description:
      "Free open source project management software for teams. Self-hosted alternative to Jira, Asana & Monday.com with kanban boards, time tracking, and team collaboration.",
    siteName: "Kaneo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaneo - Free Open Source Project Management Software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaneo - Project management made simple",
    description:
      "Free open source project management software for teams. Self-hosted alternative to Jira, Asana & Monday.com with kanban boards, time tracking, and team collaboration.",
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
