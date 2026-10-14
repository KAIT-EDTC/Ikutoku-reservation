import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes'

// URL は要件定義書8章の画面一覧のとおり
export default [
  // 公開（閲覧のみ）
  layout('routes/site-layout.tsx', [
    index('routes/home.tsx', { id: 'home' }),
    route('day/:date', 'routes/home.tsx', { id: 'day' }),
    route('guide', 'routes/guide.tsx'),
    route('news', 'routes/news.tsx'),
  ]),

  // 受付端末（登録済みの端末だけ。未登録なら API が 401 を返し、公開ページへ戻す）
  layout('routes/kiosk/layout.tsx', [
    ...prefix('kiosk', [
      index('routes/kiosk/dates.tsx'),
      route(':date', 'routes/kiosk/slots.tsx'),
      route(':date/:slotId', 'routes/kiosk/people.tsx'),
    ]),
  ]),

  // 管理（routes/admin/layout.tsx の clientLoader でログインを確かめる）
  route('admin/login', 'routes/admin/login.tsx'),
  layout('routes/admin/layout.tsx', { id: 'admin' }, [
    ...prefix('admin', [
      index('routes/admin/today.tsx'),
      route('calendar', 'routes/admin/calendar.tsx'),
      route('calendar/:date', 'routes/admin/calendar-day.tsx'),
      route('templates', 'routes/admin/templates.tsx'),
      route('settings', 'routes/admin/settings.tsx'),
      route('otp', 'routes/admin/otp.tsx'),
      route('devices', 'routes/admin/devices.tsx'),
      route('logs', 'routes/admin/logs.tsx'),
    ]),
  ]),

  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
