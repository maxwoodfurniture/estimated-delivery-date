/**
 * Calendar-date helpers.
 *
 * Every date here is a "calendar date": a Date pinned to midnight UTC.
 * All reads use UTC getters and all formatting uses timeZone "UTC", so the
 * server's own timezone never shifts a day. Wall-clock "now" in the
 * warehouse's timezone comes from getZonedNow().
 */

const MILLISECONDS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
const ISO_DATE_LENGTH = 10;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Today's calendar date and minutes past midnight in the given timezone.
 * @param {string} timeZone IANA timezone, e.g. "America/New_York"
 * @param {Date} [now]
 */
export function getZonedNow(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const partValue = (type) =>
    Number(parts.find((part) => part.type === type).value);

  return {
    date: new Date(
      Date.UTC(partValue("year"), partValue("month") - 1, partValue("day")),
    ),
    minutesSinceMidnight:
      partValue("hour") * MINUTES_PER_HOUR + partValue("minute"),
  };
}

/** "14:30" -> 870. Returns null for anything not HH:MM (24h). */
export function parseTimeToMinutes(time) {
  const match = TIME_PATTERN.exec(time ?? "");
  if (!match) return null;
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

export function isValidTime(time) {
  return parseTimeToMinutes(time) !== null;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/** First date on or after `date` whose weekday is in `workingDays`. */
export function nextWorkingDay(date, workingDays = WEEKDAYS) {
  let result = date;
  while (!workingDays.includes(result.getUTCDay())) {
    result = addDays(result, 1);
  }
  return result;
}

/** Move forward `count` working days. Zero returns the input unchanged. */
export function addBusinessDays(date, count, workingDays = WEEKDAYS) {
  let result = date;
  let added = 0;
  while (added < count) {
    result = addDays(result, 1);
    if (workingDays.includes(result.getUTCDay())) added++;
  }
  return result;
}

/** Working days strictly after `start`, up to and including `end`. */
export function businessDaysBetween(start, end, workingDays = WEEKDAYS) {
  let count = 0;
  let current = start;
  while (current < end) {
    current = addDays(current, 1);
    if (workingDays.includes(current.getUTCDay())) count++;
  }
  return count;
}

/** Date -> "YYYY-MM-DD" */
export function toIsoDate(date) {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** "YYYY-MM-DD" or "YYYY-MM-DDThh:mm:ss" -> calendar date, or null. */
export function parseIsoDate(value) {
  const match = ISO_DATE_PATTERN.exec(value ?? "");
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

/** "Feb 10 - 12" in one month, "Feb 27 - Mar 2" across months. */
export function formatDateRange(minDate, maxDate, locale) {
  const formatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const minText = minDate.toLocaleDateString(locale, formatOptions);

  if (toIsoDate(minDate) === toIsoDate(maxDate)) return minText;

  const sameMonth =
    minDate.getUTCMonth() === maxDate.getUTCMonth() &&
    minDate.getUTCFullYear() === maxDate.getUTCFullYear();
  const maxText = sameMonth
    ? String(maxDate.getUTCDate())
    : maxDate.toLocaleDateString(locale, formatOptions);

  return `${minText} - ${maxText}`;
}
