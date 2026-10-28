export function fieldDescriptionId(id: string) {
  return `${id}-description`;
}

export function fieldErrorId(id: string) {
  return `${id}-error`;
}

export function fieldDescribedBy(id: string, hasError: boolean) {
  return hasError
    ? `${fieldDescriptionId(id)} ${fieldErrorId(id)}`
    : fieldDescriptionId(id);
}
