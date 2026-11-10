import React from "react";
void React;
/* oxlint-disable react/no-array-index-key -- Email markup is rendered once; these lines never reorder. */
import { Fragment, type ReactNode } from "react";

/**
 * Plain text with its line breaks kept: each newline becomes a `<br />`.
 * Every line is still a React text node, so markup in the text is escaped and
 * renders as text, never as HTML. A `white-space: pre-line` style would be
 * shorter, but Outlook and several webmail clients ignore it.
 */
export function withLineBreaks(text: string): ReactNode[] {
  return text.split(/\r\n|\r|\n/).map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}
