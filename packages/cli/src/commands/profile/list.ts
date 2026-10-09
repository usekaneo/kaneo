import { Effect } from "effect";
import { Command } from "effect/cli";
import { ConfigStore } from "../../config/config-store.js";
import { emit } from "../../output/emit.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";
import { listProfiles } from "./profile-config.js";
import { renderProfileList } from "./render-profile-list.js";

export const runProfileList = Effect.fn("command.profile.list")(function* () {
  const session = yield* Session;
  const store = yield* ConfigStore;
  const config = yield* store.load;
  yield* emit(listProfiles(config, session.profileName), renderProfileList);
});

export const profileList = Command.make("list", {}, () =>
  runProfileList(),
).pipe(
  Command.withDescription("List stored logins and the server and user of each"),
  Command.provide(ApiLayer),
);
