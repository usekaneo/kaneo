import { notFound } from "next/navigation";
import { generateOgImage } from "@/lib/og";
import { source } from "@/lib/source";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return generateOgImage({
    primaryTextColor: "rgb(240,240,240)",
    title: page.data.title,
    description: page.data.description,
    site: "Kaneo",
  });
}

export function generateStaticParams(): {
  slug: string[];
}[] {
  return source.generateParams().map((page) => ({
    ...page,
    slug: [...page.slug, "image.png"],
  }));
}
