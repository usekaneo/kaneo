import ReactMarkdown from "react-markdown";

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children, ...props }) => (
          <h1 className="text-xl font-semibold mb-2 mt-4" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-lg font-semibold mb-2 mt-3" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-base font-semibold mb-1.5 mt-2.5" {...props}>
            {children}
          </h3>
        ),
        p: ({ children, ...props }) => (
          <p className="mb-2 leading-relaxed" {...props}>
            {children}
          </p>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc list-inside mb-2 space-y-1" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>
            {children}
          </ol>
        ),
        code: ({ children, ...props }) => (
          <code
            className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ children, ...props }) => (
          <pre
            className="bg-muted p-3 rounded border border-border/50 overflow-x-auto mb-2"
            {...props}
          >
            {children}
          </pre>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote
            className="border-l-2 border-border pl-3 italic text-muted-foreground mb-2"
            {...props}
          >
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
