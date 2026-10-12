import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { getWorkspace } from "../api/endpoints.js";
import {
  SEARCH_TYPES,
  type SearchType,
  searchWorkspace,
} from "../api/search.js";
import { InvalidArgument } from "../errors/errors.js";
import { emit } from "../output/emit.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { askQuery } from "../search/ask-query.js";
import { renderSearch } from "../search/render-search.js";
import { normalizeSearchResults } from "../search/search-results.js";
import { resolveProject, resolveWorkspaceId } from "../services/selection.js";
import { Session } from "../services/session.js";
import { ApiLayer } from "./api-layer.js";

const MAX_LIMIT = 50;

const needsWorkspaceSlug = (type: SearchType) =>
  type === "all" || type === "comments" || type === "activities";

export const runSearch = Effect.fn("command.search")(function* (options: {
  readonly query: ReadonlyArray<string>;
  readonly type: SearchType;
  readonly limit: number;
  readonly project: Option.Option<string>;
}) {
  const session = yield* Session;
  const output = yield* Output;

  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > MAX_LIMIT
  ) {
    return yield* new InvalidArgument({
      message: `--limit must be between 1 and ${MAX_LIMIT}.`,
      hint: "Pass a smaller --limit, or narrow the search with --type or -p.",
    });
  }
  const typed = options.query.join(" ").trim();
  if (typed === "" && !output.interactive) {
    return yield* new InvalidArgument({
      message: "Nothing to search for.",
      hint: 'Pass the words to search for, for example kaneo search "login redirect".',
    });
  }
  const query = typed === "" ? yield* askQuery() : typed;

  const workspaceId = yield* resolveWorkspaceId();
  const projectId = Option.isSome(options.project)
    ? (yield* resolveProject(workspaceId, options.project)).id
    : undefined;

  const [response, workspace] = yield* withSpinner("Searching")(
    Effect.all(
      [
        searchWorkspace({
          query,
          workspaceId,
          type: options.type,
          projectId,
          limit: options.limit,
        }),
        needsWorkspaceSlug(options.type)
          ? getWorkspace(workspaceId).pipe(Effect.orElseSucceed(() => null))
          : Effect.succeed(null),
      ],
      { concurrency: 2 },
    ),
  );

  const results = normalizeSearchResults(response.results, {
    type: options.type,
    workspaceId,
    workspaceSlug: workspace?.slug ?? null,
    projectId,
    webUrl: session.webUrl,
  });

  yield* emit(results, (ui) =>
    renderSearch(ui, {
      query,
      results,
      more: response.totalCount > response.results.length,
      limit: options.limit,
    }),
  );
});

export const search = Command.make(
  "search",
  {
    query: Argument.String("query").pipe(
      Argument.withDescription(
        "Words to search for, or a ticket id such as KAN-12",
      ),
      Argument.variadic(),
    ),
    type: Flag.Literals("type", SEARCH_TYPES).pipe(
      Flag.withAlias("t"),
      Flag.withDescription("Only results of this kind"),
      Flag.withDefault("all" as const),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withAlias("L"),
      Flag.withDescription(`Maximum number of results, from 1 to ${MAX_LIMIT}`),
      Flag.withDefault(20),
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription(
        "Only search in this project, by key or id, for example KAN",
      ),
      Flag.optional,
    ),
  },
  (options) => runSearch(options),
).pipe(
  Command.withDescription("Search tasks, projects and comments"),
  Command.provide(ApiLayer),
);
