import {
  addMonths,
  bookingsTimeConflict,
  datesInRange,
  monthCalendarCells,
  monthRange,
  weekStartMonday,
} from "../src/lib/domain/fleet";
import { deriveDayAvailability } from "../src/lib/domain/day-availability";
import { addDays } from "../src/lib/domain/ops";

let failed = 0;
function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const month = "2026-09-01";
const cells = monthCalendarCells(month, "2026-09-13");
assert("month grid multiple of 7", cells.length % 7 === 0 && cells.length >= 28);
const first = new Date(`${cells[0].date}T00:00:00+07:00`);
assert("monday-first week", (first.getDay() + 6) % 7 === 0);
assert("today highlighted", cells.some((cell) => cell.date === "2026-09-13" && cell.isToday));
assert("outside-month muted cells", cells.some((cell) => !cell.inMonth));
assert("month range Sep", monthRange(month).start === "2026-09-01" && monthRange(month).end === "2026-09-30");

const week = weekStartMonday("2026-09-13");
const weekDays = datesInRange(week, addDays(week, 6));
assert("week is 7 days", weekDays.length === 7);
assert("not 30-column rail", weekDays.length !== 30 && cells.length !== 30);
assert("next month", addMonths(month, 1) === "2026-10-01");

const a = {
  startDate: "2026-09-13",
  endDate: "2026-09-13",
  startTime: "09:00",
  endTime: "12:00",
  assignedVehicleId: "v1",
  status: "CONFIRMED" as const,
};
const b = {
  startDate: "2026-09-13",
  endDate: "2026-09-13",
  startTime: "11:00",
  endTime: "15:00",
  assignedVehicleId: "v1",
  status: "CONFIRMED" as const,
};
assert("vehicle time conflict", bookingsTimeConflict(a, b));

assert(
  "0 bookings without vehicles is UNKNOWN",
  deriveDayAvailability({ date: "2026-09-13", bookings: [], vehicles: [] }).status === "UNKNOWN",
);

if (failed) {
  console.error(`calendar-logic-check failed: ${failed}`);
  process.exit(1);
}
console.log("calendar-logic-check passed");
