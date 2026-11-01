# Agent model providers

The assistant and automations use AI SDK language-model providers. Models must
support tool calls; image and PDF input support depends on the model. Image,
audio, and decision-only providers cannot run this language-model tool loop.

Configure provider credentials on the server. Then open **Settings →
Administration → Settings → Agent models** to choose the allowed models and
default. Search the live catalog for Anthropic, OpenAI, Google, OpenRouter, or an
OpenAI-compatible endpoint; enter a model ID for other adapters. Only users with
`instance:settings` may change this policy. Workspace administrator privileges
alone do not grant this instance-wide permission.

Saved choices override environment model defaults and survive restarts. **Restore
server defaults** removes the saved policy. API instances pick up changes within
five seconds; open user pickers refresh within thirty seconds. Removed models
cannot start new runs, and queued runs are rechecked before inference. Running
requests may finish. Automations keep their chosen model and skip runs if it is
no longer allowed. Changes are recorded in the admin audit log. Models must
support tools; provider catalog listings do not guarantee tool or file support.

The root `.env` supplies initial model defaults and credentials:

```dotenv
KANEO_AGENT_ENABLED=true
KANEO_AGENT_MODEL=anthropic:claude-sonnet-5-5
ANTHROPIC_API_KEY=your-key
# Optional models, including other providers:
KANEO_AGENT_MODELS=anthropic:claude-sonnet-5-5,openai:gpt-6-luna
OPENAI_API_KEY=your-other-key
```

IDs use `provider:model`. Only the first colon separates the provider; model IDs
can contain additional colons. The default is always allowed, with at most 20
distinct models in total. Configure credentials for every listed provider.
Invalid settings or missing credentials disable new runs; history and review
remain available. Upstream model access is checked when a run executes.

`KANEO_AGENT_MODEL` and `KANEO_AGENT_MODELS` override `OPENROUTER_MODEL` and
`OPENROUTER_MODELS`, respectively. Existing unqualified IDs such as
`openai/gpt-6-luna` or `meta-llama/llama-4:free` still use OpenRouter, including
saved runs and automations. They are never reinterpreted as direct providers.
Queued runs recheck the current allowlist before inference. Automations whose
model is removed skip runs until their owner selects an allowed model.

## Bundled providers

Adapters load only when selected for a run. API-key variables and AWS credential
variables also accept a `_FILE` suffix for mounted secrets. Credentials never
appear in the public config response or browser environment.

| Prefix | Credentials and required configuration |
| --- | --- |
| `alibaba` | `ALIBABA_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `anthropic-aws` | `AWS_REGION`, `ANTHROPIC_AWS_WORKSPACE_ID`, plus `ANTHROPIC_AWS_API_KEY` or `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; optional `AWS_SESSION_TOKEN` |
| `azure` | `AZURE_API_KEY`, plus `AZURE_RESOURCE_NAME` or `AZURE_BASE_URL` |
| `baseten` | `BASETEN_API_KEY` |
| `bedrock` | `AWS_REGION`, plus `AWS_BEARER_TOKEN_BEDROCK` or `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; optional `AWS_SESSION_TOKEN` |
| `cerebras` | `CEREBRAS_API_KEY` |
| `cohere` | `COHERE_API_KEY` |
| `compatible` | `COMPATIBLE_BASE_URL`; optional `COMPATIBLE_API_KEY` |
| `deepinfra` | `DEEPINFRA_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `fireworks` | `FIREWORKS_API_KEY` |
| `gateway` | `AI_GATEWAY_API_KEY` or the Vercel deployment's `VERCEL_OIDC_TOKEN` |
| `gmicloud` | `GMI_CLOUD_APIKEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `huggingface` | `HUGGINGFACE_API_KEY` |
| `minimax` | `MINIMAX_API_KEY` |
| `mistral` | `MISTRAL_API_KEY` |
| `moonshotai` | `MOONSHOT_API_KEY` |
| `open-responses` | `OPEN_RESPONSES_BASE_URL` (full POST endpoint URL); optional `OPEN_RESPONSES_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `perplexity` | `PERPLEXITY_API_KEY` |
| `togetherai` | `TOGETHER_API_KEY` |
| `vertex` | `GOOGLE_VERTEX_API_KEY`, or `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, and Application Default Credentials |
| `vertex-anthropic` | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, and Application Default Credentials |
| `vertex-maas` | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, and Application Default Credentials |
| `vertex-xai` | `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, and Application Default Credentials |
| `xai` | `XAI_API_KEY` |
| `zai` | `ZAI_API_KEY` |

Override a bundled endpoint with `<PREFIX>_BASE_URL` (uppercase, hyphens replaced
with underscores), such as `ANTHROPIC_BASE_URL` or `VERTEX_ANTHROPIC_BASE_URL`.
These operator-controlled HTTP(S) endpoints may be local. URL credentials are
rejected; use the API-key variable instead.

For Ollama, LM Studio, or another Chat Completions-compatible server:

```dotenv
KANEO_AGENT_MODEL=compatible:your-tool-capable-model
COMPATIBLE_BASE_URL=http://127.0.0.1:11434/v1
```

Use an address reachable from the API process. In Docker, `127.0.0.1` means the
API container, not the host or another service.

## Community adapters and advanced authentication

Set `KANEO_AGENT_PROVIDERS_MODULE=/absolute/path/providers.mjs` to register any
additional installed AI SDK language-model adapter. Its default export is a map
of provider names to SDK provider instances. The module runs as trusted server
code, configured by the instance operator, never by workspace members.
Custom names start with a lowercase letter and contain lowercase letters,
digits, and hyphens. Bundled names are reserved.

For example, a provider with custom authentication can be registered as:

```js
import { createAnthropic } from '@ai-sdk/anthropic';

export default {
  'claude-proxy': createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_PROXY_URL,
    headers: { 'x-tenant': process.env.MODEL_TENANT },
  }),
};
```

Set `KANEO_AGENT_MODEL=claude-proxy:claude-sonnet-5-5`. Replace the import and
instance with your community adapter to use that adapter's protocol. The same
mechanism supports Azure token providers and AWS credential-provider callbacks.
Use an adapter compatible with the installed AI SDK language-model specification.
Install additional packages in `apps/api` and rebuild the deployment image;
mounting a module does not install dependencies. Place it where Node can resolve
those packages. Restart the API after changes.

## Usage and coding jobs

All providers record token usage. OpenRouter additionally supplies dollar cost;
other providers currently leave `costUsd` null. The automation monthly cap sums
recorded costs, so it does not bound unreported spending. Use your provider's
spending controls when a dollar limit is required.

OpenRouter routing options (`require_parameters`, `data_collection`, and optional
`OPENROUTER_ZDR`) apply only to OpenRouter requests. Direct providers use their
own data policies and account configuration.

GitHub repo-ci coding jobs use a separate OpenCode runner and the repository's
`OPENROUTER_API_KEY` secret. `KANEO_CODE_MODEL` remains an OpenRouter model ID,
with its existing `OPENROUTER_MODEL` fallback. Changing the assistant provider
does not change coding-job credentials or model routing.
