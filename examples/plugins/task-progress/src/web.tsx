import { defineWeb } from "@kaneo/plugin-sdk/web";
import { ProgressIcon } from "./web/progress-icon.js";
import { ProgressPanel } from "./web/progress-panel.js";
import { ProgressView } from "./web/progress-view.js";
import { translations } from "./web/translations.js";
import "./web.css";

export default defineWeb({
  projectViews: [
    {
      id: "progress",
      title: "view.title",
      icon: ProgressIcon,
      component: ProgressView,
    },
  ],
  taskPanels: [
    {
      id: "progress",
      title: "panel.title",
      component: ProgressPanel,
    },
  ],
  translations,
});
