import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { Reminder } from '@/types'
import { formatDate, parseDate } from '@/lib/dateUtils'
import { runAutoReminders } from '@/hooks/useAutoReminders'
import { differenceInDays } from 'date-fns'

const typeLabels: Record<Reminder['type'], string> = {
  soat: 'SOAT',
  tech_review: 'Rev. Técnica',
  mileage: 'Kilometraje',
  extinguisher: 'Extintor',
}

function parseDays(json: string, fallback: number[]): number[] {
  try {
    const result = JSON.parse(json)
    if (!Array.isArray(result)) return fallback
    return result
      .map((value) => Number(value))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => b - a)
  } catch {
    return fallback
  }
}

function isSameDay(timestamp?: string, today = new Date()) {
  if (!timestamp) return false
  const parsed = parseDate(timestamp)
  if (!parsed) return false
  parsed.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return parsed.getTime() === today.getTime()
}

function getDaysRemaining(dateStr?: string) {
  const dueDate = parseDate(dateStr)
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInDays(dueDate, today)
}

function getSchedule(type: Reminder['type'], settings: { soat_days?: string; tech_review_days?: string; extinguisher_days?: string } | null) {
  switch (type) {
    case 'soat':
      return parseDays(settings?.soat_days || '', [15, 7, 2])
    case 'tech_review':
      return parseDays(settings?.tech_review_days || '', [15, 7, 2])
    case 'extinguisher':
      return parseDays(settings?.extinguisher_days || '', [15])
    default:
      return []
  }
}

function shouldNotify(reminder: Reminder, schedule: number[], today: Date) {
  const daysRemaining = getDaysRemaining(reminder.due_date)
  if (daysRemaining === null) return false

  if (reminder.is_auto) {
    if (reminder.type === 'mileage') {
      return !isSameDay(reminder.last_notified_at, today)
    }
    if (daysRemaining < 0) {
      return !isSameDay(reminder.last_notified_at, today)
    }
    if (!schedule.includes(daysRemaining)) return false
    return !(reminder.notified_thresholds?.includes(daysRemaining))
  }

  if (daysRemaining < 0) return false
  if (daysRemaining !== reminder.days_before) return false
  return !(reminder.notified_thresholds?.includes(reminder.days_before))
}

async function markReminderNotified(reminder: Reminder, schedule: number[]) {
  const daysRemaining = getDaysRemaining(reminder.due_date)
  if (daysRemaining === null) return

  const updates: Partial<Reminder> = {
    last_notified_at: new Date().toISOString(),
  }

  if (reminder.is_auto) {
    if (reminder.type === 'mileage') {
      // Keep daily mileage reminders repeatable while pending.
    } else if (daysRemaining >= 0 && schedule.includes(daysRemaining)) {
      updates.notified_thresholds = [...new Set([...(reminder.notified_thresholds || []), daysRemaining])]
    }
  } else if (daysRemaining === reminder.days_before) {
    updates.notified_thresholds = [...new Set([...(reminder.notified_thresholds || []), reminder.days_before])]
  }

  try {
    const { error } = await supabase.from('reminders').update(updates).eq('id', reminder.id)
    if (error) throw error
  } catch (err) {
    console.warn('Failed to update reminder notification state:', err)
  }
}

function browserSupportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

async function requestNotificationPermission() {
  if (!browserSupportsNotifications()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

function showBrowserNotification(reminder: Reminder, vehicleInfo: { plate_number: string; model?: string } | null) {
  if (!browserSupportsNotifications() || Notification.permission !== 'granted') return
  const title = `Recordatorio ${typeLabels[reminder.type]}`
  const daysRemaining = getDaysRemaining(reminder.due_date)
  const overdueText = daysRemaining !== null && daysRemaining < 0
    ? ` · Se venció hace ${Math.abs(daysRemaining)} día${Math.abs(daysRemaining) === 1 ? '' : 's'}`
    : ''
  const vehicleText = vehicleInfo
    ? `Revisar el kilometraje de ${vehicleInfo.plate_number}: ${vehicleInfo.model ?? 'sin modelo'}. `
    : ''
  const body = `${vehicleText}${formatDate(reminder.due_date)}${overdueText}`
  const notification = new Notification(title, {
    body,
    tag: reminder.id,
  })
  notification.onclick = () => window.focus()
}

export function useReminderNotifications(userId?: string) {
  useEffect(() => {
    if (!userId) return
    let active = true

    const notify = async () => {
      // Run daily mileage increment once per day (per user)
      try {
        const lastKey = `ac_daily_mileage_${userId}`
        const todayStr = new Date().toISOString().slice(0, 10)
        const last = localStorage.getItem(lastKey)
        if (last !== todayStr) {
          const { data: vData, error: vErr } = await supabase.from('vehicles')
            .select('id, current_mileage, daily_km, next_mileage, mileage_alert_km')
            .eq('user_id', userId)

          if (!vErr && vData) {
            const updates: Promise<any>[] = []
            const updatedVehicles: any[] = []
            for (const v of vData) {
              const dk = Number(v.daily_km || 0)
              if (dk > 0) {
                const newCurrent = (v.current_mileage || 0) + dk
                updates.push(supabase.from('vehicles').update({ current_mileage: newCurrent }).eq('id', v.id))
                updatedVehicles.push({ ...v, current_mileage: newCurrent })
              }
            }
            if (updates.length > 0) {
              await Promise.all(updates)
              // Update auto reminders based on new mileage
              try { await runAutoReminders(userId, updatedVehicles) } catch (e) { console.warn('runAutoReminders failed after daily update', e) }
            }
            localStorage.setItem(lastKey, todayStr)
          }
        }
      } catch (err) {
        console.warn('Daily mileage update skipped or failed:', err)
      }

      const permissionGranted = await requestNotificationPermission()
      if (!permissionGranted) {
        if (browserSupportsNotifications() && Notification.permission === 'denied') {
          toast('Activa las notificaciones del navegador para recibir alertas.', { icon: '🔔' })
        }
        return
      }

      try {
        const [settingsRes, remindersRes] = await Promise.all([
          supabase.from('reminder_settings').select('*').eq('user_id', userId).single(),
          supabase.from('reminders').select('*').eq('user_id', userId).eq('status', 'pending').order('due_date', { ascending: true }),
        ])

        const settings = settingsRes.error?.code === 'PGRST116' ? null : settingsRes.data
        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
          console.warn('Failed to load reminder settings:', settingsRes.error)
        }

        if (remindersRes.error) {
          console.warn('Failed to load browser reminders:', remindersRes.error)
          return
        }

        const remindersData = remindersRes.data || []
        const vehicleIds = [...new Set(remindersData.map((r) => r.vehicle_id))]
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, plate_number, model')
          .in('id', vehicleIds)

        if (vehiclesError) {
          console.warn('Failed to load vehicles for notifications:', vehiclesError)
        }

        const vehicleMap = new Map((vehicles || []).map((v) => [v.id, { plate_number: v.plate_number, model: v.model }]))

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (const reminder of remindersData) {
          if (!active) return
          const schedule = getSchedule(reminder.type, settings)
          if (!shouldNotify(reminder, schedule, today)) continue
          const vehicleInfo = vehicleMap.get(reminder.vehicle_id) || null

          showBrowserNotification(reminder, vehicleInfo)
          await markReminderNotified(reminder, schedule)
        }
      } catch (err) {
        console.warn('Error in notify function:', err)
      }
    }

    notify()

    return () => { active = false }
  }, [userId])
}
