import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparisonPage } from "@/components/landing/comparison-page";
import {
  alternativePath,
  comparisonList,
  comparisons,
} from "@/lib/comparisons";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return comparisonList.map((comparison) => ({
    slug: `${comparison.slug}-alternative`,
  }));
}

function lookup(slug: string) {
  return comparisons[slug.replace(/-alternative$/, "")];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = lookup(slug);
  if (!data) return {};

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: alternativePath(data.slug) },
    openGraph: {
      type: "article",
      title: `${data.title} | Kaneo`,
      description: data.description,
      url: `https://kaneo.app${alternativePath(data.slug)}`,
    },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = lookup(slug);
  if (!data) notFound();

  return <ComparisonPage data={data} />;
}
