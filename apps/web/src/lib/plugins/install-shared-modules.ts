import { SHARED_MODULES_GLOBAL, type SharedModule } from "@kaneo/plugin-sdk";
import * as ReactQuery from "@tanstack/react-query";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import * as JsxRuntime from "react/jsx-runtime";

const sharedModules: Record<SharedModule, unknown> = {
  react: React,
  "react/jsx-runtime": JsxRuntime,
  "react/jsx-dev-runtime": JsxDevRuntime,
  "react-dom": ReactDOM,
  "@tanstack/react-query": ReactQuery,
};

(globalThis as Record<string, unknown>)[SHARED_MODULES_GLOBAL] = sharedModules;
