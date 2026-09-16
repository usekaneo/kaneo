import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostPage } from "@/components/landing/blog-post-page";
import { blogPath, getPost, getPosts } from "@/lib/blog";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `https://kaneo.app${blogPath(post.slug)}`;

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author.name, url: post.author.url }],
    alternates: { canonical: blogPath(post.slug) },
    openGraph: {
      type: "article",
      title: `${post.title} | Kaneo`,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updatedOn ?? post.date,
      authors: [post.author.name],
      section: post.category.name,
      images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.image],
    },
  };
}

/** Same category first, then the newest remaining posts, capped at three. */
function relatedPosts(slug: string, categorySlug: string) {
  const others = getPosts().filter((post) => post.slug !== slug);
  const sameCategory = others.filter(
    (post) => post.category.slug === categorySlug,
  );
  const rest = others.filter((post) => post.category.slug !== categorySlug);
  return [...sameCategory, ...rest].slice(0, 3);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <BlogPostPage
      post={post}
      related={relatedPosts(post.slug, post.category.slug)}
    />
  );
}
