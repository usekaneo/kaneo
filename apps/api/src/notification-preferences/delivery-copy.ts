import azAZ from "../../../../i18n/az-AZ.json";
import deDE from "../../../../i18n/de-DE.json";
import elGR from "../../../../i18n/el-GR.json";
import enUS from "../../../../i18n/en-US.json";
import esES from "../../../../i18n/es-ES.json";
import frFR from "../../../../i18n/fr-FR.json";
import hiIN from "../../../../i18n/hi-IN.json";
import idID from "../../../../i18n/id-ID.json";
import itIT from "../../../../i18n/it-IT.json";
import jaJP from "../../../../i18n/ja-JP.json";
import koKR from "../../../../i18n/ko-KR.json";
import mkMK from "../../../../i18n/mk-MK.json";
import nlNL from "../../../../i18n/nl-NL.json";
import plPL from "../../../../i18n/pl-PL.json";
import ptBR from "../../../../i18n/pt-BR.json";
import ruRU from "../../../../i18n/ru-RU.json";
import trTR from "../../../../i18n/tr-TR.json";
import ukUA from "../../../../i18n/uk-UA.json";
import viVN from "../../../../i18n/vi-VN.json";
import zhCN from "../../../../i18n/zh-CN.json";
import zhTW from "../../../../i18n/zh-TW.json";
import {
  resolveSupportedLocale,
  type SupportedLocale,
} from "../utils/supported-locales";

type Bundle = {
  common: { people: { someone: string } };
  notifications: {
    events: Record<string, Record<string, string>>;
    reminderLeadTime: Record<string, string>;
  };
  tasks: { status: Record<string, string> };
};

const bundles: Record<SupportedLocale, Bundle> = {
  "az-AZ": azAZ,
  "de-DE": deDE,
  "el-GR": elGR,
  "en-US": enUS,
  "es-ES": esES,
  "fr-FR": frFR,
  "hi-IN": hiIN,
  "id-ID": idID,
  "it-IT": itIT,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "mk-MK": mkMK,
  "nl-NL": nlNL,
  "pl-PL": plPL,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
  "tr-TR": trTR,
  "uk-UA": ukUA,
  "vi-VN": viVN,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

type Vars = Record<string, unknown>;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function interpolate(template: string, vars: Vars) {
  return template.replace(PLACEHOLDER, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

function plural(
  forms: Record<string, string>,
  prefix: string,
  count: number,
  locale: SupportedLocale,
) {
  const category = new Intl.PluralRules(locale).select(count);
  const template =
    forms[`${prefix}_${category}`] ?? forms[`${prefix}_other`] ?? "";
  return interpolate(template, { count });
}

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function statusLabel(bundle: Bundle, status: unknown) {
  const value = String(status ?? "");
  return Object.hasOwn(bundle.tasks.status, value)
    ? bundle.tasks.status[value]
    : toDisplayCase(value);
}

function leadTime(bundle: Bundle, eventData: Vars, locale: SupportedLocale) {
  const forms = bundle.notifications.reminderLeadTime;
  const minutes = Number(eventData.leadTimeMinutes ?? 1440);
  if (minutes % 1440 === 0) {
    return plural(forms, "days", minutes / 1440, locale);
  }
  if (minutes % 60 === 0) {
    return plural(forms, "hours", minutes / 60, locale);
  }
  return plural(forms, "minutes", minutes, locale);
}

// Uses the same i18n keys as apps/web/src/components/notification/notification-text.ts
// so email, ntfy and webhook deliveries read like the in-app list.
export function getLocalizedDeliveryContent(
  type: string,
  eventData: Vars,
  locale: string | null | undefined,
): { title: string; body: string } | null {
  const resolved = resolveSupportedLocale(locale) ?? "en-US";
  const bundle = bundles[resolved];
  // Ignore inherited keys such as "constructor" when looking up copy.
  const copy = Object.hasOwn(bundle.notifications.events, type)
    ? bundle.notifications.events[type]
    : undefined;
  if (!copy) return null;

  let vars: Vars = eventData;
  let content = copy.content;
  if (type === "task_mention") {
    const name = eventData.mentionerName;
    vars = {
      ...eventData,
      mentionerName:
        typeof name === "string" && name.trim()
          ? name
          : bundle.common.people.someone,
    };
  } else if (type === "task_status_changed") {
    vars = {
      ...eventData,
      oldStatus: statusLabel(bundle, eventData.oldStatus),
      newStatus: statusLabel(bundle, eventData.newStatus),
    };
  } else if (type === "due_date_reminder") {
    vars = { ...eventData, leadTime: leadTime(bundle, eventData, resolved) };
  } else if (type === "time_entry_created") {
    content = eventData.taskTitle
      ? copy.contentWithTask
      : copy.contentWithoutTask;
  }

  const title = copy.title ?? "";
  const body = content ?? "";
  // Keep the existing fallback for payloads still missing required values.
  const missing = [...`${title}${body}`.matchAll(PLACEHOLDER)].some(
    ([, key]) => vars[key as string] == null || vars[key as string] === "",
  );
  if (missing) return null;

  return { title: interpolate(title, vars), body: interpolate(body, vars) };
}
