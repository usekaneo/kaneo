/**
 * Copies text to the clipboard, degrading gracefully outside secure contexts.
 *
 * navigator.clipboard is only defined over HTTPS or on localhost. A self-hosted
 * instance reached over plain HTTP (a normal deployment for this project) has
 * no such API, so the deprecated execCommand path is the only one that works
 * there and is kept deliberately.
 *
 * Returns whether the text made it to the clipboard by either route.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or a transient failure: fall through to the legacy path.
    }
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "");
  // Kept off-screen rather than hidden: execCommand ignores nodes that are not
  // rendered, so display:none or visibility:hidden would break the copy.
  scratch.style.position = "fixed";
  scratch.style.top = "-9999px";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);

  try {
    scratch.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    scratch.remove();
  }
}
