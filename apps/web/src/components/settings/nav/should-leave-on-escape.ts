// Escape belongs to whatever is open on top of the page (dialogs, menus,
// selects, the mobile nav sheet) and to forms and controls; only a bare Escape on
// the settings page itself leaves settings. Closed Base UI popups can stay
// mounted (hidden, with data-closed), so only count the open ones.
const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[data-slot="dialog-popup"]',
  '[data-slot="alert-dialog-popup"]',
  '[data-slot="sheet-popup"]',
  '[data-slot="menu-popup"]',
  '[data-slot="select-popup"]',
  '[data-slot="combobox-popup"]',
  '[data-slot="autocomplete-popup"]',
  '[data-slot="popover-popup"]',
  '[data-slot="command-dialog-popup"]',
  '[data-slot="preview-card-content"]',
].join(",");

function hasOpenOverlay(root: ParentNode) {
  for (const overlay of root.querySelectorAll(OVERLAY_SELECTOR)) {
    if (overlay.hasAttribute("data-closed")) continue;
    if (overlay.closest("[hidden]")) continue;
    return true;
  }
  return false;
}

export function shouldLeaveOnEscape(event: KeyboardEvent, root: ParentNode) {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return false;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(
        'form, [role="switch"], [role="checkbox"], [role="radio"]',
      ) ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  ) {
    return false;
  }

  return !hasOpenOverlay(root);
}
