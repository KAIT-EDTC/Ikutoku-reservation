import { SLOT_STATUS_LABELS, type SlotStatus } from '@ikutoku/shared'
import { Badge, type BadgeTone } from '~/components/ui/Badge'

const TONES: Record<SlotStatus, BadgeTone> = { ok: 'success', few: 'warning', full: 'danger', stopped: 'neutral', ended: 'neutral' }

/** ○ 余裕 / △ 残りわずか / × 満員 / 受付停止 / 終了 */
export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  return <Badge tone={TONES[status]}>{SLOT_STATUS_LABELS[status]}</Badge>
}
