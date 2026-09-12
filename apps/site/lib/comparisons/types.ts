export type Cell = boolean | string;

export type Comparison = {
  slug: string;
  competitor: string;
  category: "saas" | "open-source";
  title: string;
  description: string;
  /** One line for listing pages. */
  summary: string;
  heading: string;
  subheading: string;
  /** Two or three sentences that answer "is Kaneo a good X alternative" outright. */
  verdict: string;
  facts: {
    license: string;
    hosting: string;
    sso: string;
    pricing: string;
  };
  rows: { feature: string; kaneo: Cell; them: Cell }[];
  reasons: { title: string; body: string }[];
  honestNote: string;
  migration?: { body: string; href: string; linkText: string };
  faq: { question: string; answer: string }[];
  related: string[];
  verifiedOn: string;
  sources: { label: string; href: string }[];
};

export function alternativePath(slug: string) {
  return `/${slug}-alternative`;
}
