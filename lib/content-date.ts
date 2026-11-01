/**
 * Stable dates for the sitemap's lastmod. Never `new Date()` at request time: a lastmod that moves
 * on every build teaches Google to ignore it.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * `YYYY-MM-DD`, `Mon D, YYYY` or `Mon YYYY` (the changelog's styles), as UTC midnight. A month
 * alone is its first day. Null when it does not parse.
 */
export function contentDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(Number(iso[1]), month - 1, day));
  }
  const named = /^([A-Za-z]+)\s+(?:(\d{1,2}),\s+)?(\d{4})$/.exec(text);
  if (!named) return null;
  const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase());
  if (month < 0) return null;
  return new Date(Date.UTC(Number(named[3]), month, named[2] ? Number(named[2]) : 1));
}

export function laterDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/** Parse a date the caller knows is well formed. */
export function mustContentDate(value: string): Date {
  const date = contentDate(value);
  if (!date) throw new Error(`Not a content date: ${value}`);
  return date;
}
