import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  images: {
    unoptimized: true,
    domains: ["assets.kaneo.app"],
  },
};

export default withMDX(config);
