import type { FormEvent } from 'react'

/** 取消・削除など戻せない操作の前に確かめる（<Form onSubmit={confirmSubmit('…')}>） */
export const confirmSubmit = (message: string) => (e: FormEvent) => {
  if (!confirm(message)) e.preventDefault()
}
