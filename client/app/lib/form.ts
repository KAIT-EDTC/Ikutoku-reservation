import type { z } from 'zod'
import { ApiError } from './api'

/** フォームを持つルートの clientAction が返すエラー */
export type FormErrors = {
  error?: string
  fieldErrors?: Record<string, string>
}

export function zodErrors(error: z.ZodError): FormErrors {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    fieldErrors[issue.path.join('.')] ??= issue.message
  }
  return { error: '入力内容を確認してください', fieldErrors }
}

/** API呼び出しのエラーをフォームに表示できる形にする（リダイレクトなどのResponseはそのまま投げる） */
export async function catchApiError<T>(fn: () => Promise<T>): Promise<{ data: T; errors?: undefined } | { errors: FormErrors }> {
  try {
    return { data: await fn() }
  } catch (error) {
    if (error instanceof ApiError) return { errors: { error: error.message, fieldErrors: error.fieldErrors } }
    throw error
  }
}

export function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export function optionalText(form: FormData, name: string): string | null {
  return text(form, name) || null
}

export function optionalInt(form: FormData, name: string): number | null {
  const value = text(form, name)
  return value === '' ? null : Number(value)
}

export function texts(form: FormData, name: string): string[] {
  return form.getAll(name).filter((v): v is string => typeof v === 'string')
}

/** 数値の入力欄。空なら NaN（スキーマ側で「数値を入力してください」になる） */
export function int(form: FormData, name: string): number {
  const value = text(form, name)
  return value === '' ? NaN : Number(value)
}

/** スキーマで検証してから API を呼ぶ。サーバーも同じスキーマで検証する */
export async function submit<S extends z.ZodType, T>(schema: S, values: unknown, send: (data: z.output<S>) => Promise<T>) {
  const parsed = schema.safeParse(values)
  if (!parsed.success) return { errors: zodErrors(parsed.error) }
  return catchApiError(() => send(parsed.data))
}
