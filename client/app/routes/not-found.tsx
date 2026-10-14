import { redirect } from 'react-router'

/** 知らない URL は公開ページへ */
export function clientLoader() {
  return redirect('/')
}

export default function NotFound() {
  return null
}
