import { hc } from 'hono/client'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SlotStatus } from '../server/domain.ts'
import type { AppType } from '../server/index.ts'

export const api = hc<AppType>('/').api

// Unwraps a typed RPC response. 401 sends kiosk users to the public page and admins to the login screen.
export async function call<T>(req: Promise<{ ok: boolean; status: number; json(): Promise<T> }>): Promise<T> {
  const res = await req
  if (res.status === 401) {
    location.replace(location.pathname.startsWith('/admin') ? '/admin/login' : '/')
    return new Promise(() => {}) // the page is going away
  }
  if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'エラーが発生しました。')
  return res.json()
}

export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => load().then(setData, (e: Error) => setError(e.message)), deps)
  useEffect(() => void reload(), [reload])
  return { data, error, reload }
}

// Admin actions: optional confirm, then run, then refresh; failures are shown as an alert.
export async function act(run: () => Promise<unknown>, after?: () => unknown, ask?: string) {
  if (ask && !confirm(ask)) return
  try {
    await run()
    await after?.()
  } catch (e) {
    alert((e as Error).message)
  }
}

// Form fields go to the API as strings; the server's zod schemas coerce and validate them.
export const onSubmit = (send: (values: never) => Promise<unknown>, after?: () => unknown) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  const values = Object.fromEntries(new FormData(e.currentTarget))
  return act(() => send(values as never), after)
}

export const MARK: Record<SlotStatus, string> = { ok: '○', few: '△', full: '×', stopped: '受付停止', ended: '終了' }
export const markClass = (s: SlotStatus) => (s === 'ok' ? 'm-ok' : s === 'few' ? 'm-few' : 'm-ng')
export const isDate = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
