// Every user-facing string for one list, resolved by the caller so each key
// stays static for the i18n checks.
export type ContactOptionCopy = {
  title: string;
  description: string;
  listLabel: string;
  addLabel: string;
  addPlaceholder: string;
  bulkLabel: string;
  bulkPlaceholder: string;
  bulkHint: string;
  empty: string;
  deleteTitle: (name: string) => string;
  deleteDescription: (count: number) => string;
  deleteSuccess: (count: number) => string;
};
