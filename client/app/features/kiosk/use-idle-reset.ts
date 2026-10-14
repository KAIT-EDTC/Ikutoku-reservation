import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/** F-05: 一定時間さわられなければ受付のトップに戻り、前の人の入力を残さない */
export function useIdleReset(seconds: number) {
  const navigate = useNavigate()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => navigate('/kiosk', { replace: true }), seconds * 1000)
    }
    addEventListener('pointerdown', reset)
    addEventListener('keydown', reset)
    reset()
    return () => {
      clearTimeout(timer)
      removeEventListener('pointerdown', reset)
      removeEventListener('keydown', reset)
    }
  }, [seconds, navigate])
}
