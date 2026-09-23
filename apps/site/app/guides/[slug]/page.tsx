import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidePage } from "@/components/landing/guide-page";
import { guideList, guidePath, guides } from "@/lib/guides";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return guideList.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = guides[slug];
  if (!data) return {};

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: guidePath(data.slug) },
    openGraph: {
      type: "article",
      title: `${data.title} | Kaneo`,
      description: data.description,
      url: `https://kaneo.app${guidePath(data.slug)}`,
    },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = guides[slug];
  if (!data) notFound();

  return <GuidePage data={data} />;
}
