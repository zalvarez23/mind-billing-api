/** Parse query values as string arrays (comma-separated and/or repeated params). */
export function toQueryStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const raw = Array.isArray(value) ? value : [value];
  const parsed = raw
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((s) => s.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}
