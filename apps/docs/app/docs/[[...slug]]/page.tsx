import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import Link from "fumadocs-core/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { cn } from "fumadocs-ui/utils/cn";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      editOnGithub={{
        owner: "usekaneo",
        repo: "kaneo",
        sha: "main",
        path: `apps/docs/content/docs/${page.file.path}`,
      }}
      toc={page.data.toc}
      full={page.data.full}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const image = ["https://kaneo.app/docs-og", ...slug, "image.png"].join("/");

  return {
    title: `${page.data.title} | Kaneo`,
    description: page.data.description,
    alternates: {
      canonical: `/docs/${page.slugs.join("/")}`,
    },
    openGraph: {
      images: image,
      title: `${page.data.title} | Kaneo`,
      description: page.data.description,
      url: `/docs/${page.slugs.join("/")}`,
      siteName: "Kaneo",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      images: image,
      title: `${page.data.title} | Kaneo`,
      description: page.data.description,
      creator: "@aacevski",
      site: "https://kaneo.app",
    },
  } satisfies Metadata;
}

function EditOnGitHub({ url }: { url: string }) {
  return (
    <Link
      className={cn(
        buttonVariants({
          color: "secondary",
          size: "sm",
          className: "gap-2 mr-auto",
        }),
      )}
      href={url}
    >
      <svg
        fill="currentColor"
        role="img"
        viewBox="0 0 24 24"
        className="size-3.5"
      >
        <title>GitHub</title>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
      Edit on GitHub
    </Link>
  );
}
