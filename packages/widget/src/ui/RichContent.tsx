import type { ArticleBlock } from "./types.js";

/** Blocks are plain text. No HTML or executable Markdown is interpreted. */
export function RichContent({
  body,
  blocks,
}: {
  body: string;
  blocks?: readonly ArticleBlock[];
}) {
  const content: readonly ArticleBlock[] = blocks?.length
    ? blocks
    : body.split(/\n\s*\n/).map((text) => ({ type: "paragraph", text }));
  return (
    <div className="qb-rich-content">
      {content.map((block, index) => {
        const key = `${index}:${block.type}`;
        if (block.type === "heading") return <h2 key={key}>{block.text}</h2>;
        if (block.type === "code")
          return (
            <pre key={key}>
              <code>{block.text}</code>
            </pre>
          );
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item, i) => (
                // oxlint-disable-next-line react/no-array-index-key -- Static repeated text has no component state.
                <li key={`${i}:${item}`}>{item}</li>
              ))}
            </List>
          );
        }
        return <p key={key}>{block.text}</p>;
      })}
    </div>
  );
}
