import type { Messages } from "./en-US.js";

export const elGR = {
  view: {
    title: "Gantt",
  },
  status: {
    planned: "Προγραμματισμένο",
  },
  title: "Χρονοδιάγραμμα Gantt",
  jumpToToday: "Jump to today",
  hideTasks: "Απόκρυψη εργασιών",
  showTasks: "Εμφάνιση εργασιών",
  noTasks: "Δεν υπάρχουν προγραμματισμένες εργασίες",
  noTasksSubtitle:
    "Προσθέστε ημερομηνία έναρξης, ημερομηνία λήξης ή και τα δύο στις εργασίες για να τοποθετηθούν στο χρονοδιάγραμμα του έργου.",
  noTasksFound: "Δεν βρέθηκαν εργασίες",
  noMatches: "Καμία εργασία δεν ταιριάζει με την αναζήτηση ή τα φίλτρα σας.",
  taskHeader: "Εργασία",
  updateDatesError: "Αποτυχία ενημέρωσης ημερομηνιών εργασίας",
  resizeStart: "Αλλαγή μεγέθους ημερομηνίας έναρξης",
  resizeDue: "Αλλαγή μεγέθους ημερομηνίας λήξης",
  taskAriaLabel: "{{title}}: άνοιγμα ή σύρσιμο για μετακίνηση",
  previousPeriod: "Previous period",
  nextPeriod: "Next period",
  periodStart: "Timeline start date",
  showTaskDates: "Show task dates",
} satisfies Messages;
