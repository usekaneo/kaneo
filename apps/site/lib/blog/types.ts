export type BlogAuthor = {
  id: string;
  name: string;
  role: string;
  /** Path or URL to a square avatar image. Optional; initials are shown otherwise. */
  avatar?: string;
  url?: string;
};

export type BlogCategory = {
  slug: string;
  name: string;
  description: string;
};

export type TocEntry = {
  id: string;
  text: string;
  depth: number;
};

export type BlogPost = {
  slug: string;
  title: string;
  /** Meta description and OpenGraph description. */
  description: string;
  /** One or two sentences shown on cards and in the RSS feed. */
  excerpt: string;
  date: string;
  updatedOn?: string;
  author: BlogAuthor;
  category: BlogCategory;
  /** Resolved OpenGraph image path, guaranteed to exist in public/. */
  image: string;
  featured: boolean;
  readingTimeMinutes: number;
  toc: TocEntry[];
  html: string;
  /** The raw markdown body, served verbatim to llms-full.txt. */
  markdown: string;
};

export function blogPath(slug: string) {
  return `/blog/${slug}`;
}

export function blogCategoryPath(slug: string) {
  return `/blog/category/${slug}`;
}
