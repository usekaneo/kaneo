import { Layer } from "effect";
import { KaneoApiLive } from "../api/kaneo-api.js";
import { SessionLive } from "../services/session.js";

export const ApiLayer = KaneoApiLive.pipe(Layer.provideMerge(SessionLive));
