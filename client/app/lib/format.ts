import { WEEKDAYS, weekday } from '@ikutoku/shared'

/** 2026-11-07 → 11/7(土) */
export const formatDate = (date: string) => `${+date.slice(5, 7)}/${+date.slice(8, 10)}(${WEEKDAYS[weekday(date)]})`

/** 10:00–11:00 */
export const formatTimes = (s: { startTime: string; endTime: string }) => `${s.startTime}–${s.endTime}`
