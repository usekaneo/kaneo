import type { BuiltinProvider } from "./types";

// Load only the adapter selected for a run. Image/audio-only SDK providers
// cannot drive the assistant's language-model tool loop.
export const builtinProviders: Record<string, BuiltinProvider> = {
  openai: {
    apiKeyEnv: "OPENAI_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/openai")).createOpenAI(settings),
  },
  anthropic: {
    apiKeyEnv: "ANTHROPIC_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/anthropic")).createAnthropic(settings),
  },
  google: {
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/google")).createGoogle(settings),
  },
  xai: {
    apiKeyEnv: "XAI_API_KEY",
    load: async (settings) => (await import("@ai-sdk/xai")).createXai(settings),
  },
  azure: {
    apiKeyEnv: "AZURE_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/azure")).createAzure(settings),
  },
  bedrock: {
    apiKeyEnv: "AWS_BEARER_TOKEN_BEDROCK",
    load: async (settings) =>
      (await import("@ai-sdk/amazon-bedrock")).createAmazonBedrock(settings),
  },
  "anthropic-aws": {
    apiKeyEnv: "ANTHROPIC_AWS_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/anthropic-aws")).createAnthropicAws(settings),
  },
  vertex: {
    apiKeyEnv: "GOOGLE_VERTEX_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/google-vertex")).createGoogleVertex(settings),
  },
  "vertex-anthropic": {
    load: async (settings) =>
      (
        await import("@ai-sdk/google-vertex/anthropic")
      ).createGoogleVertexAnthropic(settings),
  },
  "vertex-maas": {
    load: async (settings) =>
      (await import("@ai-sdk/google-vertex/maas")).createGoogleVertexMaas(
        settings,
      ),
  },
  "vertex-xai": {
    load: async (settings) =>
      (await import("@ai-sdk/google-vertex/xai")).createGoogleVertexXai(
        settings,
      ),
  },
  groq: {
    apiKeyEnv: "GROQ_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/groq")).createGroq(settings),
  },
  deepinfra: {
    apiKeyEnv: "DEEPINFRA_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/deepinfra")).createDeepInfra(settings),
  },
  mistral: {
    apiKeyEnv: "MISTRAL_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/mistral")).createMistral(settings),
  },
  togetherai: {
    apiKeyEnv: "TOGETHER_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/togetherai")).createTogetherAI(settings),
  },
  cohere: {
    apiKeyEnv: "COHERE_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/cohere")).createCohere(settings),
  },
  fireworks: {
    apiKeyEnv: "FIREWORKS_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/fireworks")).createFireworks(settings),
  },
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/deepseek")).createDeepSeek(settings),
  },
  cerebras: {
    apiKeyEnv: "CEREBRAS_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/cerebras")).createCerebras(settings),
  },
  perplexity: {
    apiKeyEnv: "PERPLEXITY_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/perplexity")).createPerplexity(settings),
  },
  baseten: {
    apiKeyEnv: "BASETEN_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/baseten")).createBaseten(settings),
  },
  moonshotai: {
    apiKeyEnv: "MOONSHOT_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/moonshotai")).createMoonshotAI(settings),
  },
  alibaba: {
    apiKeyEnv: "ALIBABA_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/alibaba")).createAlibaba(settings),
  },
  minimax: {
    apiKeyEnv: "MINIMAX_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/minimax")).createMiniMax(settings),
  },
  huggingface: {
    apiKeyEnv: "HUGGINGFACE_API_KEY",
    load: async (settings) =>
      (await import("@ai-sdk/huggingface")).createHuggingFace(settings),
  },
  zai: {
    apiKeyEnv: "ZAI_API_KEY",
    load: async (settings) => (await import("@ai-sdk/zai")).createZai(settings),
  },
  gmicloud: {
    apiKeyEnv: "GMI_CLOUD_APIKEY",
    load: async (settings) =>
      (await import("@ai-sdk/gmicloud")).createGmicloud(settings),
  },
  gateway: {
    apiKeyEnv: "AI_GATEWAY_API_KEY",
    load: async (settings) => (await import("ai")).createGateway(settings),
  },
  openrouter: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    load: async (settings) => {
      const provider = (
        await import("@openrouter/ai-sdk-provider")
      ).createOpenRouter(settings);
      return {
        ...provider,
        specificationVersion: "v4",
        languageModel: (id) => provider(id, { usage: { include: true } }),
      };
    },
  },
  compatible: {
    apiKeyEnv: "COMPATIBLE_API_KEY",
    load: async (settings) => {
      if (!settings.baseURL) throw new Error("Missing compatible base URL");
      return (await import("@ai-sdk/openai-compatible")).createOpenAICompatible(
        {
          ...settings,
          name: "compatible",
          baseURL: settings.baseURL,
        },
      );
    },
  },
  "open-responses": {
    apiKeyEnv: "OPEN_RESPONSES_API_KEY",
    load: async (settings) => {
      if (!settings.baseURL) throw new Error("Missing Open Responses URL");
      return (await import("@ai-sdk/open-responses")).createOpenResponses({
        ...settings,
        name: "open-responses",
        url: settings.baseURL,
      });
    },
  },
};
