import { baseOptions } from "@/app/layout.config";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kaneo - Project management made simple",
  description:
    "An open source project management platform focused on simplicity and efficiency. Self-host it, customize it, make it yours.",
  alternates: {
    canonical: "https://kaneo.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kaneo.app",
    title: "Kaneo - Project management made simple",
    description:
      "An open source project management platform focused on simplicity and efficiency. Self-host it, customize it, make it yours.",
    siteName: "Kaneo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaneo - Project management made simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaneo - Project management made simple",
    description:
      "An open source project management platform focused on simplicity and efficiency. Self-host it, customize it, make it yours.",
    images: ["/og-image.png"],
    creator: "@usekaneo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      "max-image-preview": "none",
    },
  },
  metadataBase: new URL("https://kaneo.app"),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions}>
      <Script
        defer
        data-domain="kaneo.app"
        src="https://plausible.kaneo.app/js/script.js"
      />
      {children}
    </HomeLayout>
  );
}
