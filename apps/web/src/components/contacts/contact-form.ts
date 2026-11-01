import type { Contact, ContactFields } from "@/fetchers/contact";
import type { ContactRegion, ContactType } from "./contact-options";

export type ContactForm = {
  name: string;
  phone: string;
  email: string;
  type: ContactType;
  region: ContactRegion;
  notes: string;
};

export function formFromContact(contact: Contact | null): ContactForm {
  return {
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    type: (contact?.type as ContactType | undefined) ?? "other",
    region: (contact?.region as ContactRegion | undefined) ?? "other",
    notes: contact?.notes ?? "",
  };
}

export function toFields(form: ContactForm): ContactFields {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    type: form.type,
    region: form.region,
    notes: form.notes.trim() || null,
  };
}

export function isFormValid(form: ContactForm) {
  return form.name.trim().length > 0;
}
