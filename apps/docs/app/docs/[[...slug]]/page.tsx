import path from "node:path";
import Link from "fumadocs-core/link";
import { Banner } from "fumadocs-ui/components/banner";
import { Callout } from "fumadocs-ui/components/callout";
import { DocsPage } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { APIPage } from "@/components/api-page";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;

  // Redirect /docs to /docs/core
  if (!params.slug || params.slug.length === 0) {
    redirect("/docs/core");
  }

  const page = source.getPage(params.slug);

  // Handle redirects from old docs structure to new structure
  if (!page && params.slug && params.slug.length > 0) {
    // Check if this is an old path that should redirect to /docs/core
    const firstSegment = params.slug[0];

    // If the path doesn't start with 'core' or 'api', try redirecting to core
    if (firstSegment !== "core" && firstSegment !== "api") {
      const coreSlug = ["core", ...params.slug];
      const corePage = source.getPage(coreSlug);

      if (corePage) {
        redirect(`/docs/${coreSlug.join("/")}`);
      }
    }
  }

  if (!page) notFound();

  const { body: Mdx, toc } = page.data;

  return (
    <DocsPage
      toc={toc}
      tableOfContent={{
        style: "clerk",
      }}
      editOnGithub={{
        owner: "usekaneo",
        repo: "kaneo",
        path: `apps/docs/content/docs/${page.path}`,
        sha: "main",
      }}
    >
      <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
      <p className="text-lg text-fd-muted-foreground mb-2">
        {page.data.description}
      </p>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/usekaneo/kaneo/blob/main/apps/docs/content/docs/${page.path}`}
        />
      </div>
      <div className="prose flex-1 text-fd-foreground/90 [&>p:has(+*)]:mb-0">
        <Mdx
          components={getMDXComponents({
            Banner,
            APIPage,
            a: ({ href, ...props }) => {
              const found = source.getPageByHref(href ?? "", {
                dir: path.dirname(page.path),
              });

              if (!found) return <Link href={href} {...props} />;

              return (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Link
                      href={
                        found.hash
                          ? `${found.page.url}#${found.hash}`
                          : found.page.url
                      }
                      {...props}
                    />
                  </HoverCardTrigger>
                  <HoverCardContent className="text-sm">
                    <p className="font-medium">{found.page.data.title}</p>
                    <p className="text-fd-muted-foreground">
                      {found.page.data.description}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              );
            },
            blockquote: Callout,
          })}
        />
      </div>
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
}): Promise<Metadata> {
  const { slug = [] } = await params;
  let page = source.getPage(slug);

  // Handle redirects for metadata generation
  if (!page && slug.length > 0) {
    const firstSegment = slug[0];
    if (firstSegment !== "core" && firstSegment !== "api") {
      const coreSlug = ["core", ...slug];
      page = source.getPage(coreSlug);
    }
  }

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
      creator: "@andrejsshell",
      site: "https://kaneo.app",
    },
  } satisfies Metadata;
}
