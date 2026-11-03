/**
 * Extracts per-field validation messages from the API's zod error envelope
 * (`error.details` is `error.flatten()`), so dialogs can put the message next
 * to the offending input instead of only showing a toast.
 */
export function zodFieldErrors(details: unknown): Record<string, string> {
  if (!details || typeof details !== 'object') return {};

  const fieldErrors = (details as { fieldErrors?: Record<string, string[] | undefined> })
    .fieldErrors;
  if (!fieldErrors) return {};

  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) result[field] = messages[0];
  }
  return result;
}

/** Form-level (non field specific) validation message, if any. */
export function zodFormError(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const formErrors = (details as { formErrors?: string[] }).formErrors;
  if (!formErrors || formErrors.length === 0) return null;
  return formErrors[0] ?? null;
}
