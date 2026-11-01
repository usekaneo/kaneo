import { expect, it } from "vite-plus/test";
import { addModel, makeDefault, removeModel } from "./model-policy";
import type { AdminAgentSettings } from "./types";

const settings: AdminAgentSettings = {
  enabled: true,
  managed: true,
  model: "anthropic:claude-sonnet-5-5",
  models: [
    { id: "anthropic:claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "anthropic:claude-haiku-5-5", label: "Claude Haiku 5.5" },
  ],
  providers: [{ id: "anthropic", label: "Anthropic" }],
};

it("appends a model and keeps the current default", () => {
  expect(addModel(settings, "openai:gpt-6")).toEqual({
    model: "anthropic:claude-sonnet-5-5",
    models: [
      "anthropic:claude-sonnet-5-5",
      "anthropic:claude-haiku-5-5",
      "openai:gpt-6",
    ],
  });
});

it("makes the first added model the default when none is allowed", () => {
  expect(
    addModel({ ...settings, model: null, models: [] }, "openai:gpt-6"),
  ).toEqual({ model: "openai:gpt-6", models: ["openai:gpt-6"] });
});

it.each(["openai/gpt-6-luna", "openrouter:openai/gpt-6-luna"])(
  "replaces an unavailable server default (%s) with the first usable model",
  (model) => {
    expect(
      addModel(
        {
          ...settings,
          enabled: false,
          managed: false,
          model,
          models: [{ id: model, label: "Server default" }],
        },
        "anthropic:claude-sonnet-5-5",
      ),
    ).toEqual({
      model: "anthropic:claude-sonnet-5-5",
      models: ["anthropic:claude-sonnet-5-5"],
    });
  },
);

it("keeps legacy OpenRouter IDs when that provider is connected", () => {
  const model = "anthropic/claude-sonnet-5-5:free";
  expect(
    addModel(
      {
        ...settings,
        model,
        models: [{ id: model, label: "Server default" }],
        providers: [
          ...settings.providers,
          { id: "openrouter", label: "OpenRouter" },
        ],
      },
      "anthropic:claude-haiku-5-5",
    ),
  ).toEqual({
    model,
    models: [model, "anthropic:claude-haiku-5-5"],
  });
});

it("moves the default to a remaining model when removing it", () => {
  expect(removeModel(settings, "anthropic:claude-sonnet-5-5")).toEqual({
    model: "anthropic:claude-haiku-5-5",
    models: ["anthropic:claude-haiku-5-5"],
  });
});

it("refuses to remove the last model", () => {
  expect(
    removeModel(
      { ...settings, models: settings.models.slice(0, 1) },
      "anthropic:claude-sonnet-5-5",
    ),
  ).toBeNull();
});

it("changes only the default", () => {
  expect(makeDefault(settings, "anthropic:claude-haiku-5-5")).toEqual({
    model: "anthropic:claude-haiku-5-5",
    models: ["anthropic:claude-sonnet-5-5", "anthropic:claude-haiku-5-5"],
  });
});
