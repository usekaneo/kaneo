export default function PageTitle({ title }: { title?: string }) {
  if (!title) return null;

  return <title>{title}</title>;
}
