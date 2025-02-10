function generateProjectSlug(projectName: string) {
  const words = projectName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/);

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('');
}

export default generateProjectSlug;
