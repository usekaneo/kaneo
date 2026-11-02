import type { Contact, ContactFields } from "@/fetchers/contact";

// type and region hold an option key; "" means not set.
export type ContactForm = {
  name: string;
  phone: string;
  email: string;
  type: string;
  region: string;
  notes: string;
};

export function formFromContact(contact: Contact | null): ContactForm {
  return {
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    type: contact?.type ?? "",
    region: contact?.region ?? "",
    notes: contact?.notes ?? "",
  };
}

export function toFields(form: ContactForm): ContactFields {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    type: form.type || null,
    region: form.region || null,
    notes: form.notes.trim() || null,
  };
}

// An option another person deleted may still be cached; the server rejects its
// key, so treat it as not set. Unknown while options are still loading.
export function knownOptionKey(
  options: { key: string }[] | undefined,
  key: string,
) {
  if (!options || key === "") return key;
  return options.some((option) => option.key === key) ? key : "";
}

export function isFormValid(form: ContactForm) {
  return form.name.trim().length > 0;
}
