import { redirect } from 'react-router'
import type { Route } from './+types/redirect-home'

const TARGETS: Record<string, string> = { '/guide': '/#guide', '/news': '/#news' }

/** 日別の空き状況・利用案内・お知らせはトップの1ページにまとめた。前のURLはトップの該当箇所へ送る */
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  throw redirect(TARGETS[new URL(request.url).pathname] ?? '/')
}

export default function RedirectHome() {
  return null
}
