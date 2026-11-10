import Widget = require("@quackback/widget");
import ReactAdapter = require("@quackback/widget/react");
import Version = require("@quackback/widget/version");
import UI = require("@quackback/widget/ui");

UI.WidgetView satisfies (props: UI.WidgetViewProps) => unknown;

export function useConsumer() {
  const sdk: typeof Widget.Quackback = ReactAdapter.useQuackback();
  sdk.init({ instanceUrl: "https://feedback.example.com" });
  sdk.open({ view: "messages" });
  Version.SDK_VERSION satisfies string;
  ({}) satisfies Widget.EventMap["close"];
  // @ts-expect-error Close events carry an empty object, not a scalar.
  "invalid" satisfies Widget.EventMap["close"];
  // @ts-expect-error Tracking consent must be boolean.
  sdk.tracking("true");
}
