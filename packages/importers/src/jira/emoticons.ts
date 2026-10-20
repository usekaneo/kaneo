const EMOTICONS: ReadonlyMap<string, string> = new Map([
  ["smile", "🙂"],
  ["sad", "🙁"],
  ["tongue", "😛"],
  ["biggrin", "😀"],
  ["wink", "😉"],
  ["thumbs_up", "👍"],
  ["thumbs_down", "👎"],
  ["information", "ℹ️"],
  ["check", "✅"],
  ["error", "❌"],
  ["warning", "⚠️"],
  ["add", "➕"],
  ["forbidden", "⛔"],
  ["help_16", "❓"],
  ["lightbulb_on", "💡"],
  ["lightbulb", "💡"],
  ["star_yellow", "⭐"],
  ["star_red", "⭐"],
  ["star_green", "⭐"],
  ["star_blue", "⭐"],
  ["flag", "🚩"],
  ["flag_grey", "🏳️"],
]);

export function emoticonText(src: string, alt: string): string {
  const name = /\/([\w-]+)\.(?:png|gif|svg)(?:[?#].*)?$/i.exec(src)?.[1];
  const emoji = name ? EMOTICONS.get(name.toLowerCase()) : undefined;
  return emoji ?? alt.trim();
}
