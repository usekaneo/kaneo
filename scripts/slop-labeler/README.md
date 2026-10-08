# Slop labeler

Adds `slop` when a PR adds or changes two distinct JS/TS comment blocks with
at least 20 words each and classifier scores of 99% or higher. Settings live in
[`policy.mjs`](./policy.mjs). Maintainer PRs are skipped.

The bot leaves one comment telling human authors they can ignore the result.
Later scans update that comment and remove the label if it no longer applies.
Manually added labels stay. Failed scans leave everything untouched.

Local tests found human false positives even at this threshold. A 99% score
doesn't mean 99% accuracy.

PR code is fetched as text and parsed, never executed. The workflow starts
running once merged into the default branch.

To scan an existing PR, run the workflow manually with its PR number.

Run the tests:

```sh
cd scripts/slop-labeler
npm ci --ignore-scripts
npm test
```

The classifier comes from [kqr's article](https://entropicthoughts.com/better-ai-comment-classifier).
`vendor/` preserves the [upstream source](https://git.sr.ht/~kqr/aicomment) at
`9d3abed60e628951c7b0d2cd1e1c69eddb23eb97`, the
[published model](https://xkqr.org/aicomment/model.json), and its license.
Tests check the model and inference hashes. Recheck thresholds before replacing
the model.
