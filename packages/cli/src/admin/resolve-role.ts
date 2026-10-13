import { Effect, Option } from "effect";
import { listCustomRoles } from "../api/members.js";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { withSpinner } from "../output/spinner.js";
import { pick } from "../prompts/pick.js";
import {
  BUILT_IN_ROLES,
  checkRole,
  needsCustomRoles,
  roleLabel,
} from "./roles.js";

export const resolveRole = Effect.fnUntraced(function* (
  workspaceId: string,
  input: Option.Option<string>,
  options: { readonly question: string; readonly example: string },
) {
  const output = yield* Output;
  if (Option.isSome(input)) {
    const custom = needsCustomRoles(input.value)
      ? yield* withSpinner("Loading roles")(listCustomRoles(workspaceId))
      : [];
    return yield* Effect.fromResult(checkRole(input.value, custom));
  }
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: "Which role?",
      hint: `Pass owner, admin, member, viewer or a custom role, for example ${options.example}.`,
    });
  }
  const custom = yield* withSpinner("Loading roles")(
    listCustomRoles(workspaceId),
  );
  const roles = [
    ...BUILT_IN_ROLES,
    ...custom.filter(
      (role) => !(BUILT_IN_ROLES as ReadonlyArray<string>).includes(role),
    ),
  ];
  return yield* pick(
    options.question,
    roles.map((role) => ({ title: roleLabel(role), value: role })),
  );
});
