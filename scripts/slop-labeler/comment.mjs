export const marker = "<!-- kaneo-slop-labeler:v1 -->";
const ownedMarker = "<!-- kaneo-slop-labeler:owns-label -->";

export function ownsLabel(comment) {
  return comment?.body.includes(ownedMarker) ?? false;
}

export function scanComment(flagged, owns) {
  const message = flagged
    ? `An automated code-comment detector found comments in this pull request that might be AI-generated and flagged it with the \`slop\` label.

The detector can be wrong. **If you wrote these comments yourself, please ignore this message and the label. You do not need to explain or change anything.**

This is only a review hint. It does not block or close your pull request.`
    : `The latest scan no longer triggers the automated \`slop\` label.

The detector can be wrong. If you wrote these comments yourself, please ignore this check. You do not need to explain or change anything.`;
  return `${marker}\n${owns ? `${ownedMarker}\n` : ""}${message}`;
}
