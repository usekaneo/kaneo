function stripAttentionCountPrefix(title: string) {
  return title.replace(/^\(\d+\)\s+/, "");
}

function getDocumentBaseTitle() {
  const storedBaseTitle = document.documentElement.dataset.baseTitle;

  if (storedBaseTitle) {
    return stripAttentionCountPrefix(storedBaseTitle);
  }

  return stripAttentionCountPrefix(document.title);
}

function getDocumentAttentionCount() {
  const count = Number(document.documentElement.dataset.attentionCount || "0");
  return Number.isNaN(count) ? 0 : count;
}

function formatDocumentTitle(baseTitle: string, attentionCount: number) {
  return attentionCount > 0 ? `(${attentionCount}) ${baseTitle}` : baseTitle;
}

function updateDocumentTitle() {
  const baseTitle = getDocumentBaseTitle();
  const attentionCount = getDocumentAttentionCount();

  document.title = formatDocumentTitle(baseTitle, attentionCount);
}

export function setDocumentBaseTitle(baseTitle: string) {
  document.documentElement.dataset.baseTitle =
    stripAttentionCountPrefix(baseTitle);
  updateDocumentTitle();
}

export function setDocumentAttentionCount(attentionCount: number) {
  document.documentElement.dataset.attentionCount = String(
    Math.max(0, attentionCount),
  );
  updateDocumentTitle();
}
