import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/landing/blog-index";
import { Footer } from "@/components/landing/footer";
import { breadcrumbJsonLd, JsonLd } from "@/components/landing/json-ld";
import { Navbar } from "@/components/landing/navbar";
import {
  blogCategoryPath,
  categories,
  getPostsByCategory,
  getUsedCategories,
} from "@/lib/blog";

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return getUsedCategories().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categories[slug];
  if (!category) return {};

  return {
    title: `${category.name} — Kaneo blog`,
    description: category.description,
    alternates: { canonical: blogCategoryPath(category.slug) },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { category: slug } = await params;
  const category = categories[slug];
  if (!category) notFound();

  const posts = getPostsByCategory(category.slug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Kaneo", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: category.name, path: blogCategoryPath(category.slug) },
        ])}
      />
      <Navbar />
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <BlogIndex
          activeSlug={category.slug}
          categories={getUsedCategories()}
          description={category.description}
          eyebrow="Blog"
          posts={posts}
          title={category.name}
        />
      </main>
      <Footer />
    </>
  );
}
