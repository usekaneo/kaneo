export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return <>{text}</>;
  return (
    <>
      {text
        .split(new RegExp(`(${terms.join("|")})`, "gi"))
        .map((part, index) =>
          // oxlint-disable-next-line react/no-array-index-key -- Static text fragments need positional keys for repeated matches.
          index % 2 ? <mark key={`${index}:${part}`}>{part}</mark> : part,
        )}
    </>
  );
}
