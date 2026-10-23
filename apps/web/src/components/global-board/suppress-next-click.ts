// A drag ends with a pointer release over a card, which some browsers turn
// into a click on its link. Swallow that one click so a drop never navigates.
export function suppressNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  // Drops that produce no click must not eat the user's next real one; touch
  // browsers can deliver the synthetic click a few frames after release.
  window.setTimeout(
    () => window.removeEventListener("click", swallow, { capture: true }),
    50,
  );
}
