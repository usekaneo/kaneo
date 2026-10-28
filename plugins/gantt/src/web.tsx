import { WeekStartControl } from "@kaneo/plugin-sdk/ui";
import { defineWeb } from "@kaneo/plugin-sdk/web";
import { CalendarDays } from "lucide-react";
import { GanttView } from "./web/gantt-view.js";
import { isScheduled } from "./web/is-scheduled.js";
import { translations } from "./web/translations/index.js";
import "./web.css";

export default defineWeb({
  projectViews: [
    {
      id: "timeline",
      title: "view.title",
      icon: CalendarDays,
      shortcut: "g",
      scope: "schedule",
      display: WeekStartControl,
      countsTask: isScheduled,
      component: GanttView,
    },
  ],
  translations,
});
