import { landing } from "@/lib/landing";

// The homepage and text exports use the same answers so product facts stay aligned.
export const productAnswers = [
  { ...landing.product.hosting, href: "/pricing" },
  { ...landing.product.planning, href: "/openproject-alternative" },
  { ...landing.product.sso, href: "/pricing#managed-instance" },
  { ...landing.product.agents, href: "/docs/core/integrations/mcp" },
];

export function productMarkdown() {
  return `${landing.product.overview}\n\n${productAnswers
    .map(
      ({ question, answer, link, href }) =>
        `### ${question}\n\n${answer}\n\n[${link}](https://kaneo.app${href})`,
    )
    .join("\n\n")}`;
}
