import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    template: "%s | Kaneo Documentation",
    default: "Documentation | Kaneo",
  },
  description:
    "Complete documentation for Kaneo - the open source project management platform. Learn how to deploy, configure, and use Kaneo for your team.",
  keywords: [
    "kaneo documentation",
    "project management docs",
    "self-hosted setup",
    "docker deployment",
    "kubernetes deployment",
    "nginx configuration",
    "traefik setup",
    "postgresql setup",
    "api documentation",
    "installation guide",
  ],
  openGraph: {
    title: "Kaneo Documentation",
    description:
      "Complete documentation for Kaneo - the open source project management platform. Learn how to deploy, configure, and use Kaneo for your team.",
    type: "website",
    url: "https://kaneo.app/docs",
    siteName: "Kaneo",
    images: [
      {
        url: "/og-docs.png",
        width: 1200,
        height: 630,
        alt: "Kaneo Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaneo Documentation",
    description:
      "Complete documentation for Kaneo - the open source project management platform. Learn how to deploy, configure, and use Kaneo for your team.",
    images: ["/og-docs.png"],
  },
  alternates: {
    canonical: "https://kaneo.app/docs",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  githubUrl: "https://github.com/usekaneo/kaneo",
  sidebar: {
    banner: (
      <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 p-2 text-white text-sm">
        <span>📚</span>
        <span>New to Kaneo? Start with our Quick Start guide!</span>
      </div>
    ),
  },
  nav: {
    ...baseOptions.nav,
    children: (
      <div className="flex items-center gap-2">
        <a
          href="https://demo.kaneo.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Try Demo
        </a>
        <a
          href="https://github.com/usekaneo/kaneo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          GitHub
        </a>
      </div>
    ),
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...docsOptions}>
      <Script
        defer
        data-domain="kaneo.app"
        src="https://plausible.kaneo.app/js/script.js"
      />
      {children}
    </DocsLayout>
  );
}
