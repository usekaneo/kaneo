import { asana } from "./asana";
import { azureDevops } from "./azure-devops";
import { basecamp } from "./basecamp";
import { clickup } from "./clickup";
import { focalboard } from "./focalboard";
import { githubProjects } from "./github-projects";
import { huly } from "./huly";
import { jira } from "./jira";
import { kanboard } from "./kanboard";
import { leantime } from "./leantime";
import { linear } from "./linear";
import { monday } from "./monday";
import { notion } from "./notion";
import { openproject } from "./openproject";
import { plane } from "./plane";
import { planka } from "./planka";
import { redmine } from "./redmine";
import { shortcut } from "./shortcut";
import { taiga } from "./taiga";
import { trello } from "./trello";
import type { Comparison } from "./types";
import { vikunja } from "./vikunja";
import { wekan } from "./wekan";
import { wrike } from "./wrike";
import { youtrack } from "./youtrack";

export type { Cell, Comparison } from "./types";
export { alternativePath } from "./types";

const all: Comparison[] = [
  jira,
  trello,
  linear,
  asana,
  clickup,
  monday,
  notion,
  basecamp,
  wrike,
  shortcut,
  youtrack,
  azureDevops,
  githubProjects,
  planka,
  plane,
  openproject,
  redmine,
  vikunja,
  taiga,
  huly,
  leantime,
  focalboard,
  wekan,
  kanboard,
];

export const comparisonList = all;

export const comparisons: Record<string, Comparison> = Object.fromEntries(
  all.map((comparison) => [comparison.slug, comparison]),
);

export function getComparison(slug: string) {
  return comparisons[slug];
}

export const comparisonSlugs = all.map((comparison) => comparison.slug);
