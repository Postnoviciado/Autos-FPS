import { format, differenceInDays, parseISO, isValid, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DateStatus } from '@/types'

export function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null
  try {
    // PocketBase dates: "2024-12-31 00:00:00.000Z" or ISO
    const d = parseISO(dateStr.replace(' ', 'T'))
    return isValid(d) ? addDays(d, 1) : null
  } catch {
    return null
  }
}

export function formatDate(dateStr?: string): string {
  const d = parseDate(dateStr)
  if (!d) return 'No registrado'
  return format(d, 'dd/MM/yyyy', { locale: es })
}

export function formatDateInput(dateStr?: string): string {
  const d = parseDate(dateStr)
  if (!d) return ''
  return format(d, 'yyyy-MM-dd')
}

export function getDateStatus(dateStr?: string): DateStatus {
  const d = parseDate(dateStr)
  if (!d) return { level: 'none', label: 'No registrado' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = differenceInDays(d, today)

  if (days < 0) return { level: 'expired', label: 'Vencido', daysRemaining: days }
  if (days === 0) return { level: 'urgent', label: 'Vence hoy', daysRemaining: 0 }
  if (days <= 7) return { level: 'urgent', label: `Vence en ${days}d`, daysRemaining: days }
  if (days <= 30) return { level: 'upcoming', label: `Vence en ${days}d`, daysRemaining: days }
  return { level: 'valid', label: `Vigente (${days}d)`, daysRemaining: days }
}

export function getMileageStatus(current?: number, next?: number): DateStatus {
  if (!current || !next) return { level: 'none', label: 'Sin datos' }
  const diff = next - current
  if (diff <= 0) return { level: 'expired', label: `Vencido (${Math.abs(diff).toLocaleString()} km pasados)` }
  if (diff <= 500) return { level: 'urgent', label: `Faltan ${diff.toLocaleString()} km` }
  if (diff <= 1000) return { level: 'upcoming', label: `Faltan ${diff.toLocaleString()} km` }
  return { level: 'valid', label: `Faltan ${diff.toLocaleString()} km` }
}

export function getMileageStatusWithAlert(current?: number, next?: number, alertThreshold?: number | null): DateStatus {
  if (alertThreshold === undefined || alertThreshold === null) {
    return getMileageStatus(current, next)
  }
  if (!current || !next) return { level: 'none', label: 'Sin datos' }
  const diff = next - current
  if (diff <= 0) return { level: 'expired', label: `Vencido (${Math.abs(diff).toLocaleString()} km pasados)` }
  if (diff <= alertThreshold) return { level: 'urgent', label: `Faltan ${diff.toLocaleString()} km` }
  return { level: 'valid', label: `Faltan ${diff.toLocaleString()} km` }
}

export function getOverdueDays(dateStr?: string): number | null {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = differenceInDays(d, today)
  return days < 0 ? Math.abs(days) : null
}

export function statusColors(level: DateStatus['level']) {
  switch (level) {
    case 'expired': return 'bg-red-100 text-red-700 border border-red-200'
    case 'urgent': return 'bg-red-100 text-red-700 border border-red-200'
    case 'upcoming': return 'bg-amber-100 text-amber-800 border border-amber-200'
    case 'valid': return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    default: return 'bg-slate-100 text-slate-600 border border-slate-200'
  }
}
