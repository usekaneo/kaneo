import { fileURLToPath } from "node:url";

const brandLoader = fileURLToPath(
  new URL("../../scripts/branding/site-loader.cjs", import.meta.url),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  transpilePackages: ["@kaneo/branding"],
  turbopack: {
    // Turbopack ignores loader output unless `as` is set; "*" keeps the file's own type.
    rules: {
      "*.{ts,tsx,js,jsx}": {
        condition: { path: /^(?:apps\/site\/)?(?:app|components|lib)\// },
        loaders: [brandLoader],
        as: "*",
      },
      "*.json": {
        condition: { path: /(?:^|\/)i18n\/[^/]+\.json$/ },
        loaders: [brandLoader],
        as: "*",
      },
    },
  },
  webpack(config) {
    config.module.rules.unshift({
      test: /\.[jt]sx?$/,
      include: [
        fileURLToPath(new URL("./app", import.meta.url)),
        fileURLToPath(new URL("./components", import.meta.url)),
        fileURLToPath(new URL("./lib", import.meta.url)),
      ],
      use: [brandLoader],
    });
    config.module.rules.unshift({
      test: /\.json$/,
      include: [fileURLToPath(new URL("../../i18n", import.meta.url))],
      use: [brandLoader],
    });
    return config;
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
