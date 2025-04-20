import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/page";
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
    <DocsPage toc={page.data.toc} full={page.data.full}>
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

  const image = [
    "https://usekaneo.github.io/kaneo/docs-og",
    ...slug,
    "image.png",
  ].join("/");

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
