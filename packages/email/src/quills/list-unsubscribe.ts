/**
 * RFC 2369 `List-Unsubscribe` and RFC 8058 one-click headers for a
 * notification that carries an unsubscribe link.
 *
 * The link given here must be one-click capable: a `POST` to the same URL with
 * the form body `List-Unsubscribe=One-Click` unsubscribes, while a `GET` only
 * shows a page. Mail providers send that POST themselves, with no cookies and
 * no user present, when the recipient presses their own Unsubscribe button.
 *
 * One-click is only offered over HTTPS (RFC 8058 section 3.1), so a plain-http
 * development link gets the RFC 2369 header alone. No link, no headers.
 *
 * Every rung carries these as ordinary custom headers: SES on the Simple
 * content's header list, Resend in its `headers` map, and SMTP through
 * Nodemailer's `headers` option.
 */
export function listUnsubscribeHeaders(
  unsubscribeUrl?: string,
): Record<string, string> {
  if (!unsubscribeUrl) return {};
  let url: URL;
  try {
    url = new URL(unsubscribeUrl);
  } catch {
    return {};
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return {};
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${url.href}>`,
  };
  if (url.protocol === "https:")
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return headers;
}
