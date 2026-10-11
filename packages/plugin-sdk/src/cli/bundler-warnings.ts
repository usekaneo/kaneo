type BundlerWarning = {
  code?: string;
  id?: string;
};

export function filterWarnings<W extends BundlerWarning>(
  warning: W,
  warn: (warning: W) => void,
) {
  if (
    warning.code === "INVALID_ANNOTATION" &&
    warning.id?.includes("node_modules")
  ) {
    return;
  }
  warn(warning);
}
