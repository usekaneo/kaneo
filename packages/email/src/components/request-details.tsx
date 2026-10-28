import React from "react";
import { type EmailLocale, emailHtmlLang } from "../templates/resolve-locale";
import { type DetailRow, DetailRows } from "./detail-rows";
import { type DateInput, formatDateTime } from "./format-date";
import { Frame } from "./frame";

void React;

export type RequestDevice = {
  browser?: string;
  os?: string;
};

export type RequestContext = {
  email?: string;
  instance?: string;
  requestedAt?: DateInput;
  device?: RequestDevice;
};

type Messages = {
  title: string;
  account: string;
  instance: string;
  requested: string;
  device: string;
  browserOn: (browser: string, os: string) => string;
};

const messages: Record<EmailLocale, Messages> = {
  en: {
    title: "Request details",
    account: "Account",
    instance: "Instance",
    requested: "Requested",
    device: "Device",
    browserOn: (browser, os) => `${browser} on ${os}`,
  },
  de: {
    title: "Details zur Anfrage",
    account: "Konto",
    instance: "Instanz",
    requested: "Angefordert",
    device: "Gerät",
    browserOn: (browser, os) => `${browser} auf ${os}`,
  },
  vi: {
    title: "Chi tiết yêu cầu",
    account: "Tài khoản",
    instance: "Máy chủ",
    requested: "Thời gian yêu cầu",
    device: "Thiết bị",
    browserOn: (browser, os) => `${browser} trên ${os}`,
  },
  ja: {
    title: "リクエストの詳細",
    account: "アカウント",
    instance: "インスタンス",
    requested: "リクエスト日時",
    device: "デバイス",
    browserOn: (browser, os) => `${os} の ${browser}`,
  },
  "zh-tw": {
    title: "請求詳細資料",
    account: "帳號",
    instance: "執行個體",
    requested: "請求時間",
    device: "裝置",
    browserOn: (browser, os) => `${os} 上的 ${browser}`,
  },
};

function describeDevice(copy: Messages, device?: RequestDevice) {
  if (device?.browser && device.os) {
    return copy.browserOn(device.browser, device.os);
  }
  return device?.browser ?? device?.os;
}

type RequestDetailsProps = RequestContext & {
  locale: EmailLocale;
};

export function RequestDetails({
  locale,
  email,
  instance,
  requestedAt,
  device,
}: RequestDetailsProps) {
  const copy = messages[locale];
  const rows: DetailRow[] = [
    { label: copy.account, value: email },
    { label: copy.instance, value: instance },
    {
      label: copy.requested,
      value: requestedAt
        ? formatDateTime(requestedAt, emailHtmlLang(locale))
        : undefined,
    },
    { label: copy.device, value: describeDevice(copy, device) },
  ].filter((row) => Boolean(row.value));

  if (rows.length === 0) {
    return null;
  }

  return (
    <Frame title={copy.title} panelPadding="8px 20px">
      <DetailRows rows={rows} />
    </Frame>
  );
}
