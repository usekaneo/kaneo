import i18n from "i18next";

// Thrown before any optimistic update when a change is made offline: the
// offline app is read-only, so nothing is queued to replay later.
export class OfflineError extends Error {
  constructor() {
    super(i18n.t("common:offline.changesDisabled"));
    this.name = "OfflineError";
  }
}
