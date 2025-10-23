import { Banner } from "fumadocs-ui/components/banner";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

export const metadata: Metadata = {
	title: {
		template: "%s",
		default: "Kaneo",
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
	nav: {
		...baseOptions.nav,
	},
};

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<>
			<Banner className="w-full">
				You are viewing an older version of the documentation.
				<Link
					className="text-fd-primary hover:underline ml-2"
					href="https://kaneo.app/docs"
					target="_blank"
					rel="noopener noreferrer"
				>
					View the latest version
				</Link>
			</Banner>
			<DocsLayout {...docsOptions}>
				<Script
					defer
					data-domain="kaneo.app"
					src="https://plausible.kaneo.app/js/script.js"
				/>

				{children}
			</DocsLayout>
		</>
	);
}
