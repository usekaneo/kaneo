import { source } from "@/lib/source";
import type { MetadataRoute } from "next";

export const revalidate = false;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string): string =>
    new URL(path, "https://kaneo.app").toString();

  return [
    {
      url: url("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: url("/docs"),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...(await Promise.all(
      source.getPages().map((page) => {
        const { lastModified } = page.data;

        return {
          url: url(page.url),
          lastModified: lastModified ? new Date(lastModified) : undefined,
          changeFrequency: "daily",
          priority: 0.5,
        } as MetadataRoute.Sitemap[number];
      }),
    )),
  ];
}
