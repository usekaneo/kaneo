import type { Metadata } from "next";

type PageMetadata = Omit<Metadata, "title" | "description" | "alternates"> & {
  title: string;
  description: string;
  alternates: NonNullable<Metadata["alternates"]> & { canonical: string };
};

// Next.js replaces nested metadata rather than merging it. Every page needs
// its own complete preview instead of inheriting the homepage's title and URL.
export function withSocialMetadata(metadata: PageMetadata): Metadata {
  const title = `${metadata.title} | Kaneo`;
  return {
    ...metadata,
    openGraph: {
      type: "website",
      siteName: "Kaneo",
      title,
      description: metadata.description,
      url: metadata.alternates.canonical,
      images: [
        { url: "/images/hero.png", width: 1200, height: 630, alt: title },
      ],
      ...metadata.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metadata.description,
      images: ["/images/hero.png"],
      ...metadata.twitter,
    },
  };
}
