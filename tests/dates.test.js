import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessDays,
  businessDaysBetween,
  formatDateRange,
  getZonedNow,
  nextWorkingDay,
  parseIsoDate,
  parseTimeToMinutes,
  toIsoDate,
} from "../app/services/dates.js";

const LOCALE = "en-US";
const day = (iso) => parseIsoDate(iso);

test("getZonedNow uses the warehouse timezone, not the server clock", () => {
  // 18:30 UTC on a Monday is 14:30 in New York (EDT) and 11:30 in Los Angeles.
  const now = new Date("2026-10-12T18:30:00Z");
  const newYork = getZonedNow("America/New_York", now);
  const losAngeles = getZonedNow("America/Los_Angeles", now);

  assert.equal(toIsoDate(newYork.date), "2026-10-12");
  assert.equal(newYork.minutesSinceMidnight, 14 * 60 + 30);
  assert.equal(losAngeles.minutesSinceMidnight, 11 * 60 + 30);
});

test("getZonedNow rolls the date in timezones already past midnight", () => {
  const now = new Date("2026-10-13T02:00:00Z");
  assert.equal(toIsoDate(getZonedNow("America/New_York", now).date), "2026-10-12");
});

test("parseTimeToMinutes accepts HH:MM only", () => {
  assert.equal(parseTimeToMinutes("14:00"), 840);
  assert.equal(parseTimeToMinutes("00:00"), 0);
  assert.equal(parseTimeToMinutes("24:00"), null);
  assert.equal(parseTimeToMinutes("2pm"), null);
  assert.equal(parseTimeToMinutes(undefined), null);
});

test("nextWorkingDay skips weekends", () => {
  assert.equal(toIsoDate(nextWorkingDay(day("2026-10-17"))), "2026-10-19");
  assert.equal(toIsoDate(nextWorkingDay(day("2026-10-14"))), "2026-10-14");
});

test("addBusinessDays skips weekends and honors custom working days", () => {
  assert.equal(toIsoDate(addBusinessDays(day("2026-10-16"), 1)), "2026-10-19");
  assert.equal(toIsoDate(addBusinessDays(day("2026-10-16"), 0)), "2026-10-16");
  assert.equal(
    toIsoDate(addBusinessDays(day("2026-10-16"), 1, [1, 2, 3, 4, 5, 6])),
    "2026-10-17",
  );
});

test("businessDaysBetween counts working days after start", () => {
  assert.equal(businessDaysBetween(day("2026-10-16"), day("2026-10-20")), 2);
  assert.equal(businessDaysBetween(day("2026-10-16"), day("2026-10-16")), 0);
});

test("parseIsoDate reads FedEx day formats without a timezone shift", () => {
  assert.equal(toIsoDate(parseIsoDate("2026-02-12")), "2026-02-12");
  assert.equal(toIsoDate(parseIsoDate("2026-02-12T23:59:00")), "2026-02-12");
  assert.equal(parseIsoDate("not a date"), null);
});

test("formatDateRange collapses same-month ranges", () => {
  assert.equal(
    formatDateRange(day("2026-02-10"), day("2026-02-12"), LOCALE),
    "Feb 10 - 12",
  );
  assert.equal(
    formatDateRange(day("2026-02-27"), day("2026-03-02"), LOCALE),
    "Feb 27 - Mar 2",
  );
  assert.equal(
    formatDateRange(day("2026-02-10"), day("2026-02-10"), LOCALE),
    "Feb 10",
  );
});
