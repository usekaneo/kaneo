# Motion plans

From the improve-animations audit at commit 813dcb36 (Emil Kowalski design-engineering bar).

| # | Plan | Severity | Status |
|---|------|----------|--------|
| 001 | Motion tokens and easing discipline | HIGH | DONE |
| 002 | Scope transition-all on hot surfaces | HIGH | DONE |
| 003 | Instant command palette | HIGH | DONE |
| 004 | Press feedback | MEDIUM | DONE |
| 005 | prefers-reduced-motion | MEDIUM | DONE |
| 006 | Fluid micro-moments | MEDIUM | DONE |
| 007 | Board enter/exit animation | MEDIUM | DONE |

Execution order: 001 → 002 → 003 → 004 (004 depends on 002's card transition property list) → 005 → 006 → 007. 007 carries the dnd-kit coexistence constraint; read its Boundaries before starting.

Vetted non-findings (do not "fix"): toast 500ms swipe curve, accordion/collapsible height transitions, caret blink, Cmd+F find-bar animation, popover/tooltip positioner property lists.
