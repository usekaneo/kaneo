import { defineWeb } from "@kaneo/plugin-sdk/web";
import { CalendarDays } from "lucide-react";
import { GanttView } from "./web/gantt-view.js";
import { translations } from "./web/translations/index.js";
import "./web.css";

export default defineWeb({
  projectViews: [
    {
      id: "timeline",
      title: "view.title",
      icon: CalendarDays,
      shortcut: "g",
      component: GanttView,
    },
  ],
  translations,
});
