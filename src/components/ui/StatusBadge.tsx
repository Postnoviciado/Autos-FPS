import { statusColors } from '@/lib/dateUtils'
import type { DateStatus } from '@/types'
import clsx from 'clsx'

interface Props {
  status: DateStatus
  className?: string
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold shadow-sm', statusColors(status.level), className)}>
      {status.label}
    </span>
  )
}
