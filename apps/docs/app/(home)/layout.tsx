import { baseOptions } from "@/app/layout.config";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kaneo",
  description:
    "An open source project management platform focused on simplicity and efficiency.",
  alternates: {
    canonical: "https://kaneo.app",
  },
  openGraph: {
    images: ["/og.png"],
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
