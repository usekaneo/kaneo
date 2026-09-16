import type { BlogCategory, BlogPost } from "@/lib/blog/types";
import { blogCategoryPath } from "@/lib/blog/types";
import { cn } from "@/lib/utils";
import { BlogPostCard } from "./blog-post-card";
import { FadeIn } from "./fade-in";

export function BlogCategoryFilter({
  categories,
  activeSlug,
}: {
  categories: BlogCategory[];
  activeSlug?: string;
}) {
  const chip =
    "inline-flex h-8 items-center rounded-lg border px-3 text-sm transition-colors";

  return (
    <nav aria-label="Blog categories" className="flex flex-wrap gap-2">
      <a
        className={cn(
          chip,
          activeSlug
            ? "border-border/70 text-foreground/70 hover:bg-accent hover:text-foreground"
            : "border-transparent bg-primary text-primary-foreground",
        )}
        href="/blog"
      >
        All posts
      </a>
      {categories.map((category) => (
        <a
          className={cn(
            chip,
            activeSlug === category.slug
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border/70 text-foreground/70 hover:bg-accent hover:text-foreground",
          )}
          href={blogCategoryPath(category.slug)}
          key={category.slug}
        >
          {category.name}
        </a>
      ))}
    </nav>
  );
}

export function BlogIndex({
  eyebrow,
  title,
  description,
  categories,
  activeSlug,
  featured,
  posts,
}: {
  eyebrow: string;
  title: string;
  description: string;
  categories: BlogCategory[];
  activeSlug?: string;
  featured?: BlogPost;
  posts: BlogPost[];
}) {
  return (
    <section className="px-6 pt-14 pb-16 md:pt-20 md:pb-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-2xl">
          <FadeIn delay={0}>
            <p className="font-medium text-primary text-sm">{eyebrow}</p>
          </FadeIn>
          <FadeIn delay={60}>
            <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.06] md:text-5xl">
              {title}
            </h1>
          </FadeIn>
          <FadeIn delay={120}>
            <p className="mt-5 text-balance text-foreground/70 text-lg leading-relaxed">
              {description}
            </p>
          </FadeIn>
        </div>

        <FadeIn delay={180}>
          <div className="mt-10">
            <BlogCategoryFilter
              activeSlug={activeSlug}
              categories={categories}
            />
          </div>
        </FadeIn>

        {featured ? (
          <div className="mt-10">
            <BlogPostCard featured post={featured} />
          </div>
        ) : null}

        {posts.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : null}

        {!featured && posts.length === 0 ? (
          <p className="mt-10 text-foreground/60">
            Nothing here yet. Check back soon.
          </p>
        ) : null}
      </div>
    </section>
  );
}
