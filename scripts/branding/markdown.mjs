import { brand, brandText } from "../../branding/index.cjs";

export function brandMarkdown(source) {
  const markdown = brand.npmScope
    ? source
    : source.replace(/\n## Install with npm[\s\S]*?(?=\n## |$)/g, "");
  return brandText(
    markdown
      .replace(
        /^.*id6828574501.*$/gm,
        brand.appStoreUrl
          ? `Download the mobile app from the [App Store](${brand.appStoreUrl}).`
          : "Mobile app distribution is supplied by your instance operator.",
      )
      .replace(/\n## Install with Homebrew[\s\S]*?(?=\n## |$)/g, "")
      .replace(
        /^.*https:\/\/github\.com\/usekaneo\/homebrew-tap.*(?:\n|$)/gm,
        "",
      )
      .replace(
        /<Card\b[^>]*href=["'][^"']*(?:installation\/drim|deployments\/railway)[^"']*["'][^>]*>[\s\S]*?<\/Card>/g,
        "",
      )
      .replace(
        /^.*\]\([^)]*\/(?:installation\/drim(?:-migration)?|deployments\/railway)[^)]*\).*(?:\n|$)/gm,
        "",
      ),
  );
}
