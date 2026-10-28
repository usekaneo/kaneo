import { readFileSync } from "node:fs";
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";
import {
  prepareModel,
  tokenizersFor,
  classify,
  collapseProbs,
  perClass,
  HUMAN_VS_ROBOT,
} from "./vendor/classifier.mjs";
import { preprocess } from "./vendor/preprocess.mjs";
import { policy } from "./policy.mjs";

const nlp = winkNLP(model);
const classifier = prepareModel(
  JSON.parse(
    readFileSync(new URL("./vendor/model.json", import.meta.url), "utf8"),
  ),
);
const tokens = tokenizersFor(classifier, (run) =>
  nlp.readDoc(run).tokens().out(nlp.its.pos),
);

export function scoreComment(comment, file) {
  const prose = preprocess(comment, file);
  const words = prose.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (words < policy.minWords) return { prose, words, score: null };
  const prediction = classify(classifier, tokens, prose);
  const score = collapseProbs(
    perClass(classifier, prediction.probs),
    HUMAN_VS_ROBOT,
  ).find(([label]) => label === "robot")[1];
  return { prose, words, score };
}
