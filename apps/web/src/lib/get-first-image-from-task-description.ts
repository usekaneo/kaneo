/**
 * Returns the first image URL found in task description markdown / embedded HTML.
 */
export function getFirstImageSrcFromTaskDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) {
    return null;
  }

  const markdownImage = /!\[[^\]]*]\(\s*([^)\s]+)\s*\)/;
  const mdMatch = markdownImage.exec(description);
  if (mdMatch?.[1]) {
    const url = mdMatch[1].trim();
    if (url) return url;
  }

  const htmlImg = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i.exec(
    description,
  );
  if (htmlImg?.[1]) {
    const url = htmlImg[1].trim();
    if (url) return url;
  }

  return null;
}
