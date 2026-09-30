export const REPO = "usekaneo/kaneo";

export function prNumber(value) {
  const match = String(value)
    .trim()
    .match(
      /^(?:https:\/\/github\.com\/usekaneo\/kaneo\/pull\/)?([1-9]\d{0,6})\/?$/,
    );
  if (!match)
    throw new Error(
      "Enter a Kaneo PR number or its github.com/usekaneo/kaneo/pull/… URL.",
    );
  return Number(match[1]);
}
