export type EditorTheme = {
  surface: string;
  ink: string;
  body: string;
  ink2: string;
  muted: string;
  faint: string;
  placeholder: string;
  link: string;
  hairline: string;
  fill: string;
  fillStrong: string;
  primary: string;
  onPrimary: string;
  selection: string;
};

export function editorCss(theme: EditorTheme): string {
  return `
:root { color-scheme: light dark; }
html, body { margin: 0; padding: 0; background: ${theme.surface}; overflow: hidden; }
.ProseMirror > :first-child { margin-top: 0; }
.ProseMirror > :last-child { margin-bottom: 0; }
body {
  font-family: -apple-system, "Geist", system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}
.ProseMirror {
  min-height: 24px;
  box-sizing: border-box;
  padding: 0;
  font-size: 15px;
  line-height: 1.6;
  color: ${theme.body};
  caret-color: ${theme.ink};
  outline: none;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.ProseMirror ::selection { background: ${theme.selection}; }
.ProseMirror p { margin: 0 0 6px; }
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: ${theme.placeholder};
  float: left;
  height: 0;
  pointer-events: none;
}
.ProseMirror strong { color: ${theme.ink}; font-weight: 600; }
.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
  margin: 14px 0 6px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.26;
  color: ${theme.ink};
}
.ProseMirror h1 { font-size: 21px; }
.ProseMirror h2 { font-size: 19px; }
.ProseMirror h3 { font-size: 17px; }
.ProseMirror ul, .ProseMirror ol { margin: 4px 0; padding-inline-start: 22px; }
.ProseMirror li { margin: 2px 0; }
.ProseMirror li::marker { color: ${theme.muted}; }
.ProseMirror li > p { margin: 0; }
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-inline-start: 0; }
.ProseMirror ul[data-type="taskList"] > li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0;
}
.ProseMirror ul[data-type="taskList"] > li > label {
  flex-shrink: 0;
  margin-top: 3px;
  display: inline-flex;
}
.ProseMirror ul[data-type="taskList"] > li > label > span { display: none; }
.ProseMirror ul[data-type="taskList"] > li > div { flex: 1; min-width: 0; }
.ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border-radius: 4px;
  border: 1px solid ${theme.fillStrong};
  background: ${theme.surface};
  display: grid;
  place-content: center;
}
.ProseMirror ul[data-type="taskList"] input[type="checkbox"]:checked {
  background: ${theme.primary};
  border-color: ${theme.primary};
}
.ProseMirror ul[data-type="taskList"] input[type="checkbox"]:checked::after {
  content: "";
  width: 10px;
  height: 6px;
  margin-top: -2px;
  border-left: 2.5px solid ${theme.onPrimary};
  border-bottom: 2.5px solid ${theme.onPrimary};
  transform: rotate(-45deg);
}
.ProseMirror ul[data-type="taskList"] > li[data-checked="true"] > div p {
  color: ${theme.faint};
  text-decoration: line-through;
}
.ProseMirror a {
  color: ${theme.link};
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.ProseMirror :not(pre) > code {
  font-family: ui-monospace, "Geist Mono", monospace;
  font-size: 0.86em;
  background: ${theme.fill};
  border: 1px solid ${theme.hairline};
  border-radius: 6px;
  padding: 1px 4px;
  color: ${theme.ink};
}
.ProseMirror pre {
  margin: 8px 0;
  padding: 10px 12px;
  background: ${theme.fill};
  border: 1px solid ${theme.hairline};
  border-radius: 8px;
  overflow-x: auto;
}
.ProseMirror pre code {
  font-family: ui-monospace, "Geist Mono", monospace;
  font-size: 14px;
  color: ${theme.ink};
}
.ProseMirror blockquote {
  margin: 8px 0;
  padding-left: 12px;
  border-left: 2px solid ${theme.fillStrong};
  color: ${theme.ink2};
}
.ProseMirror hr { border: none; border-top: 1px solid ${theme.hairline}; margin: 14px 0; }
.ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 8px 0; }
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  margin: 8px 0;
  overflow: hidden;
}
.ProseMirror th, .ProseMirror td {
  border: 1px solid ${theme.hairline};
  padding: 6px 8px;
  vertical-align: top;
}
.ProseMirror th { background: ${theme.fill}; font-weight: 600; text-align: left; color: ${theme.ink}; }
.ProseMirror th p, .ProseMirror td p { margin: 0; }
.kaneo-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 1px 8px;
  border-radius: 6px;
  background: ${theme.fill};
  border: 1px solid ${theme.hairline};
  color: ${theme.ink};
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: baseline;
}
.ProseMirror [data-type="kaneo-embed"] {
  margin: 8px 0;
  padding: 8px 10px;
  border: 1px solid ${theme.hairline};
  border-radius: 8px;
  background: ${theme.fill};
  overflow: hidden;
}
.ProseMirror [data-type="kaneo-embed"] iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 6px; }
`;
}
