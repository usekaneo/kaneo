import { generateFiles } from "fumadocs-openapi";
import { openapi } from "@/lib/openapi";

void generateFiles({
  input: openapi,
  output: "./content/docs/api",
  includeDescription: true,
});
