export function configTemplate(
  packageName: string,
  importName: string,
): string {
  return [
    'import { defineConfig } from "@kaneo/config";',
    `import ${importName} from "${packageName}";`,
    "",
    "export default defineConfig({",
    `  plugins: [${importName}()],`,
    "});",
    "",
  ].join("\n");
}
