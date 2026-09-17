# What would make Peekareq worth using?

The target is more consequential bugs caught per dollar and per minute of maintainer attention. A cheaper model, more agents, or more comments does not establish a better reviewer. Start with Kaneo's stack and behavior, then test whether the approach generalizes.

## Where to compete

1. **Explain a reachable failure.** A finding needs the input or state, the changed execution path, the expected contract, and the observed or source-supported consequence. Verify caller guards, global middleware and database constraints before describing impact. A real quote is necessary but does not prove the explanation.
2. **Connect the UI to its behavior.** Use Peekareq's existing browser scenarios to connect an API/cache/state change to a visible outcome. For UI findings, attach the exact affected state and screenshot; add a reproducible interaction or axe result where applicable. Do not infer accessibility compliance from screenshots alone.
3. **Prefer differential evidence.** The same input should pass on base and fail on head. For supported pure functions, structured probes already run in a restricted container. Integration and browser probes still need a repeatable seeded environment; do not replace it with invented mocks that merely confirm the model's assumptions.
4. **Spend according to unresolved risk.** Read the relevant dependency path, cache immutable context, reuse successful responses, and reserve the maximum before every paid request. Escalate a small ambiguous authorization/data finding only when a stronger model can answer a specific missing question. Do not send every file to several models.
5. **Earn the right to interrupt.** One finding per root cause, no pre-existing bugs presented as regressions, no generic advice, no repeated comments on unchanged commits. An inconclusive or partially covered review must remain visibly inconclusive. Keep recommendations separate from demonstrated failures.

## What the prototype tests

A single cheap model performs bounded investigation, targeted source retrieval and a skeptical verification pass. Deterministic checks validate source quotes and diff anchors. An optional probe runner distinguishes observed differential failures from source-only hypotheses. No commercial reviewer comparison or automatic GitHub code-review posting is enabled.

The current gaps are consequential: source selection misses some global guards and constraints, model verification can repeat an incorrect consequence, and large PRs can exceed context or output limits. Prompt instructions alone have not solved these gaps. The next implementation should prioritize dependency-aware retrieval and smaller review units with explicit coverage accounting, then use execution to resolve the strongest remaining hypotheses.

## Quality gate before automatic comments

Freeze a version and evaluate unseen natural PRs at immutable revisions. Have maintainers adjudicate the complete finding, including its stated consequence, rather than crediting a matching keyword or file. Record missed bugs, false alarms, duplicate comments, unsupported cases, time and total cost. Keep development cases separate; never tune on a held-out result and still call it held out.

For a commercial comparison, obtain reviews of the same PR revisions with comparable repository context and settings. Compare meaningful-bug recall at the same false-alarm budget. Report uncertainty and disagreements; an absent bot comment is not ground truth. Existing public bot comments from different revisions are insufficient to claim superiority.

An initial release gate should require at least 95% confirmed actionable findings on a substantially larger natural-PR sample, no known severe false claim, explicit handling of partial reviews, and a persistent production spending limit. This is a proposed target, not a measured property of this prototype. Maintainer approval of usefulness matters more than a synthetic score.

## Why this is not a unique algorithm yet

Commercial tools already invest in repository context and verification. See [CodeRabbit's context engineering description](https://www.coderabbit.ai/blog/context-engineering-ai-code-reviews) and [Qodo's code review overview](https://docs.qodo.ai/code-review/overview). Peekareq's opportunity is to demonstrate better evidence and lower cost for a focused workflow. That must be measured, not asserted.
