import type { BlogCategory } from "./types";

const all: BlogCategory[] = [
  {
    slug: "alternatives",
    name: "Alternatives",
    description:
      "Round-ups of the best alternatives to the big project management tools, with pricing, licensing, and the honest case for each one.",
  },
  {
    slug: "evergreens",
    name: "Evergreens",
    description:
      "Longer pieces on choosing, running, and paying for project management software.",
  },
  {
    slug: "product",
    name: "Product",
    description:
      "New capabilities, how to use them, and the thinking behind what we ship.",
  },
  {
    slug: "updates",
    name: "Updates",
    description: "Releases, changes, and news from the Kaneo project.",
  },
];

export const categoryList = all;

export const categories: Record<string, BlogCategory> = Object.fromEntries(
  all.map((category) => [category.slug, category]),
);
