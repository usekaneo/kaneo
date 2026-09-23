import fs from "node:fs";
import path from "node:path";
import { authors } from "./authors";
import { categories } from "./categories";
import { parseFrontmatter } from "./frontmatter";
import { readingTimeMinutes, renderMarkdown } from "./markdown";
import type { BlogPost } from "./types";

export { authorList, authors } from "./authors";
export { categories, categoryList } from "./categories";
export type { BlogAuthor, BlogCategory, BlogPost, TocEntry } from "./types";
export { blogCategoryPath, blogPath } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const FALLBACK_IMAGE = "/images/hero.png";

function required(value: unknown, field: string, file: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Blog post ${file} is missing a "${field}" in frontmatter.`,
    );
  }
  return value.trim();
}

function resolveImage(explicit: unknown, slug: string, categorySlug: string) {
  const candidates = [
    typeof explicit === "string" ? explicit : null,
    `/images/blog/${slug}.png`,
    `/images/blog/category-${categorySlug}.png`,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(PUBLIC_DIR, candidate.replace(/^\//, "")))) {
      return candidate;
    }
  }

  return FALLBACK_IMAGE;
}

function readPost(file: string): BlogPost {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
  const { data, content } = parseFrontmatter(raw, file);

  const authorId = required(data.author, "author", file);
  const author = authors[authorId];
  if (!author) {
    throw new Error(
      `Blog post ${file} references unknown author "${authorId}". Add it to lib/blog/authors.ts.`,
    );
  }

  const categorySlug = required(data.category, "category", file);
  const category = categories[categorySlug];
  if (!category) {
    throw new Error(
      `Blog post ${file} references unknown category "${categorySlug}". Add it to lib/blog/categories.ts.`,
    );
  }

  const date = required(data.date, "date", file);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Blog post ${file} has a "date" that is not YYYY-MM-DD.`);
  }

  const markdown = content.trim();
  const { html, toc } = renderMarkdown(markdown);

  return {
    slug,
    title: required(data.title, "title", file),
    description: required(data.description, "description", file),
    excerpt: required(data.excerpt, "excerpt", file),
    date,
    updatedOn: typeof data.updatedOn === "string" ? data.updatedOn : undefined,
    author,
    category,
    image: resolveImage(data.image, slug, categorySlug),
    featured: data.featured === true,
    readingTimeMinutes: readingTimeMinutes(markdown),
    toc,
    html,
    markdown,
  };
}

function loadPosts(): BlogPost[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map(readPost)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
    );
}

// The content directory does not change during a build, so read it once.
let cache: BlogPost[] | null = null;

export function getPosts(): BlogPost[] {
  if (!cache) cache = loadPosts();
  return cache;
}

export function getPost(slug: string) {
  return getPosts().find((post) => post.slug === slug);
}

export function getPostsByCategory(categorySlug: string) {
  return getPosts().filter((post) => post.category.slug === categorySlug);
}

/** The post to lead the index with: newest flagged post, otherwise newest post. */
export function getFeaturedPost() {
  const posts = getPosts();
  return posts.find((post) => post.featured) ?? posts[0];
}

/** Categories that actually have posts, so the filter row never dead-ends. */
export function getUsedCategories() {
  const posts = getPosts();
  return Object.values(categories).filter((category) =>
    posts.some((post) => post.category.slug === category.slug),
  );
}
