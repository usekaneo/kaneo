/**
 * Returns true when an event target is inside the code-block language picker.
 *
 * `MouseEvent.relatedTarget` is typed as `EventTarget | null` and at runtime
 * can be a non-Element node (e.g. a Text node when the pointer moves between
 * text runs) or `null`. Calling `.closest()` on either throws, so the
 * `instanceof Element` guard is load-bearing for the mouseleave handlers in
 * the comment and task-description editors.
 */
export function isInCodeBlockLanguagePicker(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(".kaneo-codeblock-language") !== null
  );
}
