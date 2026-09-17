# Evaluation: 2026-09-17

**Cheap to run, but not ready for automatic code-review comments.** The frozen version improved on the development cases and then performed worse than the single-pass baseline on held-out cases. There is no evidence here that it beats CodeRabbit or Qodo. The next work is described in [STRATEGY.md](STRATEGY.md).

## Results

These are local retained findings; nothing was posted to GitHub. A finding is credited only when its stated trigger and consequence are supported, not merely because it mentions the expected bug. Incorrect impact claims are counted against the reviewer. One ambiguous held-out finding remains explicitly unresolved.

| Set | Pipeline | Known regressions with fully confirmed findings | Confirmed findings / all retained findings | False findings | Unresolved findings |
| --- | --- | --- | --- | --- | --- |
| Development: 8 regressions + 8 controls | Investigation + verification | 7/8 | 7/8 | 1 | 0 |
| Development: same cases | Single pass | 5/8 | 5/6 | 1 | 0 |
| Held out: 7 regressions + 7 controls | Investigation + verification | 1/7 | 2/7 | 4 | 1 |
| Held out: same cases | Single pass | 2/7 | 3/5 | 2 | 0 |

The held-out investigation pipeline has one additional valid finding on a separate endpoint; this increases confirmed findings, not recall of the manifest's target bug. The single-pass baseline has two valid findings for separate changes within one regression family. Counting findings and counting detected cases are different metrics.

The unresolved fieldPosition finding identifies a real schema mismatch but overreaches about client ordering and response validation. Crediting its narrower valid core would raise the investigation pipeline to 2/7 known regressions and 3/7 confirmed findings. That still would not pass the proposed quality gate. Do not present the conservative score as a precise estimate of general reviewer quality.

## What failed

- Correct source quotes did not ensure correct consequences. The assignee report claimed an event would be published after a database write that violates a foreign key.
- The GitHub integration report identified removed workspace checks but incorrectly claimed unauthenticated access; global authentication remained in place.
- The PATCH report incorrectly asserted that general authentication rejects bearer API keys, despite an explicit branch that accepts them.
- Both pipelines treated an unchanged mutation error handler as a newly introduced bug.
- The investigator called broader cache invalidation a bug without retrieving the project-level query it was intended to refresh.
- Citation/schema failures withheld some otherwise plausible candidates. The scores measure the complete reporting pipeline, not the raw model's ability to mention a bug.

These failures survived a skeptical model pass. More agreement from the same model is not sufficient evidence. No prompts or retrieval logic were changed after the version-6 held-out run began.

## Method and limitations

Fifteen historical fixes were replayed in synthetic regression and fix/control directions, with immutable base/head commits. Eight families were used for development, seven were held out until the pipeline was frozen. Restoring one production file to its pre-fix state preserves tests and other files from the fixed tree; some examples therefore have unusually clear contracts or inconsistencies that real PRs would not. Several families share a source commit. This is a small, related sample, not an independent competitive benchmark.

Both pipelines used `deepseek/deepseek-v4-flash`, the same initial diff and bounded source context, price limits and final citation validation. The investigation pipeline could retrieve more context, repair citations and make up to three calls. It did not have the same token/call budget as the single-pass baseline. Earlier development baselines had output-schema problems and are not used in these results. Development responses were cached and reused where requests were identical; there were no repeated trials to measure model variance.

Judgments were made by the same coding assistant that built the prototype, through source inspection, not by independent maintainers. Read the finding and its reason before relying on a label. [Evaluation JSON files](evaluation/) preserve the outputs, immutable revisions, provenance, judgments and scores. Reproduce a score locally without API spending:

```sh
node scripts/ui-review-bot/code-review/score.mjs \
  scripts/ui-review-bot/code-review/evaluation/verified-holdout.json \
  scripts/ui-review-bot/code-review/evaluation/verified-holdout-judgments.json
```

## Execution and natural PR checks

A manually specified checklist-parser probe passed on base and failed twice on head in the pinned, isolated Docker image. It returned `{total: 0, completed: 0}` on base and `{total: 1, completed: 1}` on the regression for checkboxes inside an invalid closing fence. [The exact probe and observations](evaluation/manual-differential-probe.json) are retained. The model did not autonomously produce this probe.

- PR #1741 at `1b5438a39d6f5c8a07eb376972b07c36459a61f1`: private review completed in about 19 seconds for $0.000905, retained no findings, and omitted no changed files. Source excerpts were still bounded. This is a smoke test, not evidence of bug-free code.
- PR #1735 at `79c56da54ab33aea45c43e8cdd26a46ff61f71bc`: version 6 returned an incomplete model response and no completed review. An earlier development attempt also omitted large UI files. Large-change coverage and response limits remain unresolved.

The bot test suite passes 72 tests, covering existing UI behavior plus budget accounting, citation validation, review filtering, isolated-runner constraints and scoring. Repository Biome and i18n checks pass. Those checks validate software mechanics, not AI judgment quality.

## Spending

Total provider-reported AI spend for the entire experiment was **$0.0995473**, including development iterations, baseline comparisons, held-out cases and the natural PR attempts. All 174 paid requests had known costs when the experiment ended. The ledger commits $0.1144794 after its 15% allowance, under the fixed $0.85 internal cap and the user's $1 limit. No paid hosting or new CI review service was launched.

[Cost details](evaluation/costs.json) distinguish new charges from the original prices of reused cached responses. These are measured experiment costs, not a promise that arbitrary PRs will cost the same. Automatic paid review triggers and GitHub code-review posting remain disabled.
