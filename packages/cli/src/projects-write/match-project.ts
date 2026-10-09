type ProjectRef = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
};

export function matchProjectRecord<P extends ProjectRef>(
  projects: ReadonlyArray<P>,
  reference: string,
): P | undefined {
  const trimmed = reference.trim();
  const normalized = trimmed.normalize("NFKC").toLowerCase();
  return (
    projects.find((project) => project.id === trimmed) ??
    projects.find(
      (project) => project.slug.normalize("NFKC").toLowerCase() === normalized,
    ) ??
    projects.find((project) => project.name.toLowerCase() === normalized)
  );
}
