import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
export const today = (now = new Date()) => format(now, "yyyy-MM-dd");
export const nextDate = (date: string, days: number) =>
  format(addDays(parseISO(date), days), "yyyy-MM-dd");
export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(a), parseISO(b));
export const displayDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) => new Intl.DateTimeFormat(undefined, options).format(parseISO(date));
export const clockMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
