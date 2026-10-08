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
  searchPlaceholder: "Αναζήτηση προγραμματισμένων αιτημάτων...",
  hideTasks: "Απόκρυψη εργασιών",
  showTasks: "Εμφάνιση εργασιών",
  noTasks: "Δεν υπάρχουν προγραμματισμένες εργασίες",
  noTasksSubtitle:
    "Προσθέστε ημερομηνία έναρξης, ημερομηνία λήξης ή και τα δύο στις εργασίες για να τοποθετηθούν στο χρονοδιάγραμμα του έργου.",
  noTasksFound: "Δεν βρέθηκαν εργασίες",
  noTasksMatch:
    'Δεν υπάρχουν προγραμματισμένες εργασίες που να ταιριάζουν με "{{query}}"',
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
