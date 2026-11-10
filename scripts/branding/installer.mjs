import { brand, brandText } from "../../branding/index.cjs";

// Change quoted installer copy without renaming functions or interpreting variables.
export function brandInstaller(source, filename) {
  const powershell = filename.endsWith(".ps1");
  const literals = powershell
    ? /'(?:''|[^'])*'|"(?:`.|[^"`])*"/g
    : /'[^']*'|"(?:\\.|[^"\\])*"/g;
  return source.replace(literals, (literal) => {
    const quote = literal[0];
    const escapedName = powershell
      ? quote === "'"
        ? brand.name.replaceAll("'", "''")
        : brand.name.replace(/[`"$]/g, (char) => "`" + char)
      : quote === "'"
        ? brand.name.replaceAll("'", "'\\''")
        : brand.name.replace(/[\\$`"]/g, (char) => "\\" + char);
    return (
      quote +
      brandText(literal.slice(1, -1)).replaceAll(brand.name, escapedName) +
      quote
    );
  });
}
