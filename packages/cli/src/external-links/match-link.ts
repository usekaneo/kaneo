import type { ExternalLink } from "../api/external-links.js";

export type LinkMatch =
  | { readonly kind: "found"; readonly link: ExternalLink }
  | {
      readonly kind: "ambiguous";
      readonly candidates: ReadonlyArray<ExternalLink>;
    }
  | { readonly kind: "none" };

const MIN_PREFIX = 4;

function only(matches: ReadonlyArray<ExternalLink>): LinkMatch | null {
  const [first] = matches;
  if (!first) return null;
  return matches.length === 1
    ? { kind: "found", link: first }
    : { kind: "ambiguous", candidates: matches };
}

export function matchLink(
  links: ReadonlyArray<ExternalLink>,
  reference: string,
): LinkMatch {
  const wanted = reference.trim();
  if (wanted === "") return { kind: "none" };
  const exact = links.find((link) => link.id === wanted);
  if (exact) return { kind: "found", link: exact };
  const byUrl = only(links.filter((link) => link.url === wanted));
  if (byUrl) return byUrl;
  if (wanted.length < MIN_PREFIX) return { kind: "none" };
  return (
    only(links.filter((link) => link.id.startsWith(wanted))) ?? {
      kind: "none",
    }
  );
}
