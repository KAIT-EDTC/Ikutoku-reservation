import { adminReserveSchema, slotInputSchema, slotUpdateSchema } from '@ikutoku/shared'
import { api, unwrap } from '~/lib/api'
import { catchApiError, int, submit, text } from '~/lib/form'

/** 日別画面（今日の予約・カレンダーの日付）のフォーム。intent で操作を分ける */
export async function dayAction(request: Request) {
  const form = await request.formData()
  const param = { param: { id: text(form, 'id') } }
  switch (text(form, 'intent')) {
    case 'reserve': {
      const values = { slotId: int(form, 'slotId'), people: int(form, 'people'), overbook: form.has('overbook') }
      const r = await submit(adminReserveSchema, values, (json) => unwrap(api.admin.reservations.$post({ json })))
      return r.errors ?? { issued: r.data }
    }
    case 'cancel':
      return (await catchApiError(() => unwrap(api.admin.reservations[':id'].cancel.$post(param)))).errors ?? { ok: true }
    case 'create': {
      const values = { date: text(form, 'date'), startTime: text(form, 'startTime'), endTime: text(form, 'endTime'), capacity: int(form, 'capacity') }
      return (await submit(slotInputSchema, values, (json) => unwrap(api.admin.slots.$post({ json })))).errors ?? { ok: true }
    }
    case 'update': {
      const values = { startTime: text(form, 'startTime'), endTime: text(form, 'endTime'), capacity: int(form, 'capacity') }
      return (await submit(slotUpdateSchema, values, (json) => unwrap(api.admin.slots[':id'].$put({ ...param, json })))).errors ?? { ok: true }
    }
    case 'delete':
      return (await catchApiError(() => unwrap(api.admin.slots[':id'].$delete(param)))).errors ?? { ok: true }
  }
  throw new Error('unknown intent')
}

export const loadDay = (date: string) => unwrap(api.admin.slots.$get({ query: { date } }))
