import { Extension, getMarksBetween, InputRule } from "@tiptap/core";

function trailingInlineCodeMatch(text: string) {
  const match = /`([^`\n]+)`(\s)$/.exec(text);
  if (!match) return null;
  if (match.index > 0 && text[match.index - 1] === "`") return null;

  return {
    index: match.index,
    text: match[0],
  };
}

// TipTap's built-in Code mark input rule only fires when the closing backtick
// is typed at the end (`...`). When a user types ``, moves left, types `hi`,
// moves right, and presses Space, the closing backtick was already in the
// document so the built-in rule never matches. This rule converts `` `hi` ``
// into an inline `code` mark when followed by whitespace while keeping the
// trailing whitespace unmarked.
export const InlineCodeInputRule = Extension.create({
  name: "inlineCodeInputRule",

  addInputRules() {
    return [
      new InputRule({
        find: trailingInlineCodeMatch,
        handler: ({ state, range }) => {
          const codeMark = this.editor.schema.marks.code;
          if (!codeMark) return null;
          if (state.doc.resolve(range.from).parent.type.spec.code) return null;

          const excludedMarks = getMarksBetween(range.from, range.to, state.doc)
            .filter(
              (item) =>
                item.mark.type !== codeMark &&
                item.mark.type.excludes(codeMark),
            )
            .filter((item) => item.to > range.from + 1);
          if (excludedMarks.length > 0) return null;

          const { tr } = state;
          tr.delete(range.to - 2, range.to - 1);
          tr.addMark(range.from + 1, range.to - 2, codeMark.create());
          tr.delete(range.from, range.from + 1);
          tr.removeStoredMark(codeMark);
        },
      }),
    ];
  },
});
