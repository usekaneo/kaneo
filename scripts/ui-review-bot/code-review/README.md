# Peekareq code review experiment

Private, evidence-based code review for Kaneo. No GitHub comments are posted by this command and no webhook behavior changes. This is an evaluation build, not a demonstrated replacement for other reviewers.

```sh
npm --prefix scripts/ui-review-bot run review -- 1735
npm --prefix scripts/ui-review-bot run review -- 1735 --probes
npm --prefix scripts/ui-review-bot run review -- --base <40-character SHA> --head <40-character SHA>
npm --prefix scripts/ui-review-bot run review -- --budget
```

Uses the existing `~/.env.openroutercopythis` key, or `OPENROUTER_API_KEY`. Reports and immutable-response caches live under `.cache/code-review`. Source is read from immutable Git revisions without checking out or executing a PR. Reports distinguish omitted context, rejected candidates, source-reviewed hypotheses and reproduced failures. Zero findings does not approve a PR.

## Budget

The development ledger is shared across all runs and models at `~/.local/state/peekareq/code-review-budget.json`. Its fixed cap is **$0.85**, including a 15% allowance added to provider-reported charges, leaving additional headroom below the user's $1 spending limit. No paid subscriptions, cloud deployments, or paid CI runners are required.

Before each request, an atomic locked transaction reserves a conservative maximum based on UTF-8 input bytes plus chat overhead, 8,192 maximum output tokens including reasoning, and provider price ceilings. OpenRouter routing requires parameter support and caps prompt/completion prices at $0.30/$0.60 per million tokens with zero per-request/image charges. A crash, timeout, HTTP error or absent usage retains the full reservation. Provider-reported overspend halts further requests. Failed calls are not silently retried. Successful cached responses incur no new model calls.

Do not delete/reset the ledger to bypass the task budget. The cap applies to this local evaluation session, not other programs using the key. It is not a distributed billing system for a hosted bot. Automatic paid GitHub review triggers remain disabled until a separate persistent production budget and quality gate exist.

## Review pipeline

1. Read the diff, numbered before/after source excerpts, nearby tests, imports, and route boundaries.
2. Investigate concrete changed behavior across validation, authorization, persistence and consumers. Retrieve bounded extra files or symbol references requested by the reviewer.
3. Validate candidate shape, changed-line anchors and exact source quotes. Correct a quoted line offset only when its source match is unique. Invented or ambiguous quotes are rejected.
4. A skeptical verification pass looks for caller guards, middleware, intended contract changes, unreachable triggers and pre-existing behavior. Publishable findings require a contract citation and an explanation of what counterevidence was checked. Model agreement is not execution proof.
5. Optionally execute structured input/output probes for standalone modules in Docker. No model-generated shell commands or executable test snippets are accepted. Other modules remain source-reviewed and unsupported probes are explicitly marked.

The default evaluation model is `deepseek/deepseek-v4-flash`, chosen from the live OpenRouter catalog for price testing. It is not claimed to be the most accurate model.

## Isolated probes

`--probes` requires Docker and this pinned official Node image, downloaded once explicitly:

```sh
docker pull node@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81
```

The container runs without network, credentials, writable repository mounts, root privileges or Linux capabilities. CPU, memory, process count, output size and execution time are bounded. Runtime-importing modules are unsupported. A reproduction must match the expected result on base, fail on head, and produce the same failure twice. A failing baseline, passing head or unstable result withholds the proposed finding. These are observed tests, not formal proofs; malicious source may attempt to manipulate its own process.

## Evaluation

See [the strategy](STRATEGY.md) and [measured results](EVALUATION.md) before interpreting findings. The prototype is not ready for automatic review comments.

```sh
npm --prefix scripts/ui-review-bot run review:benchmark -- prepare
npm --prefix scripts/ui-review-bot run review:benchmark -- verified dev
npm --prefix scripts/ui-review-bot run review:benchmark -- baseline dev
# Freeze the pipeline before inspecting held-out outputs.
npm --prefix scripts/ui-review-bot run review:benchmark -- verified holdout
npm --prefix scripts/ui-review-bot run review:benchmark -- baseline holdout
```

The initial corpus contains 15 historical fixes, each replayed in a synthetic regression direction and a fix/control direction (30 cases). Tests from the fixed tree remain available as contracts. Eight families are development cases; seven are held out. The reviewed input excludes labels, fix titles, future fixes and other bots' comments. Synthetic reversals are easier than arbitrary real PRs and must never be described as a competitive real-PR benchmark. Controls require adjudication: a historical fix can itself contain a different real bug.

Judge each finding by root cause, not matching filename. Track known regressions detected, false findings, inconclusive reviews, severity and cost. Keep the original outputs. Existing commercial-bot reviews can be compared only at matching revisions; absence of a comment is not evidence a bug did not exist. Before automatic posting or superiority claims, evaluate unseen natural PRs, inspect disagreements, and compare important-bug recall at the same false-alarm budget.
