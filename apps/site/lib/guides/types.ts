export type GuideItem = {
  name: string;
  body: string;
  href?: string;
  meta?: string;
};

export type GuideSection = {
  heading: string;
  body?: string[];
  items?: GuideItem[];
};

export type Guide = {
  slug: string;
  /** The literal question people ask, used as the H1. */
  question: string;
  title: string;
  description: string;
  summary: string;
  /** Two to four sentences that answer the question outright. */
  answer: string;
  sections: GuideSection[];
  faq: { question: string; answer: string }[];
  related: { label: string; href: string }[];
  updatedOn: string;
};

export function guidePath(slug: string) {
  return `/guides/${slug}`;
}
