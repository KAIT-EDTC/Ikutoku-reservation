export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 日本時間の現在 { date: 'YYYY-MM-DD', time: 'HH:MM', iso: 'YYYY-MM-DD HH:MM:SS' }。JSTに夏時間はない */
export function nowJst(ms = Date.now()) {
  const iso = new Date(ms + 9 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), iso: iso.slice(0, 19).replace('T', ' ') }
}

export const weekday = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

export function addDays(date: string, n: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)
}

export function datesBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 366; d = addDays(d, 1)) out.push(d)
  return out
}
