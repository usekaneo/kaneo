export const policy = {
  label: "slop",
  threshold: 0.99,
  minWords: 20,
  minMatches: 2,
  maxFiles: 100,
  maxFileBytes: 250_000,
  maxTotalBytes: 5_000_000,
};

export function supportedFile(file) {
  return (
    /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/.test(file) &&
    !/(^|\/)(?:node_modules|vendor|fixtures|__fixtures__|_fixtures|dist|build|generated)(\/|$)/.test(
      file,
    ) &&
    !/(?:\.d\.[cm]?ts|\.min\.js|\.gen\.[cm]?[jt]sx?)$/.test(file)
  );
}
