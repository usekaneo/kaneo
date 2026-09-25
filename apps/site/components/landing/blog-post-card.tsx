import { formatBlogDateShort } from "@/lib/blog/format";
import type { BlogPost } from "@/lib/blog/types";
import { blogPath } from "@/lib/blog/types";
import { BlogAvatar } from "./blog-byline";
import { ContentCard } from "./content-card";

export function BlogPostCard({
  post,
  featured = false,
}: {
  post: BlogPost;
  featured?: boolean;
}) {
  return (
    <ContentCard
      body={post.excerpt}
      featured={featured}
      footer={
        <>
          <BlogAvatar author={post.author} className="size-6" />
          <span>{post.author.name}</span>
          <span aria-hidden="true">·</span>
          <span>{post.readingTimeMinutes} min read</span>
        </>
      }
      href={blogPath(post.slug)}
      meta={[
        <time dateTime={post.date} key="date">
          {formatBlogDateShort(post.date)}
        </time>,
        post.category.name,
      ]}
      title={post.title}
    />
  );
}
