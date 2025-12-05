import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { transformerTwoslash } from "fumadocs-twoslash";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // postprocess: {
    //   extractLinkReferences: true,
    // },
  },
});

export default defineConfig({
  // plugins: [lastModified()],
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      transformers: [
        // ...(rehypeCodeDefaultOptions.transformers ?? []),
      ],
    },
  },
});
