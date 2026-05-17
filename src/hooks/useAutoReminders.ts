import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Vehicle, Reminder, ReminderSettings } from '@/types'
import { parseISO, isValid } from 'date-fns'
import { getDateStatus } from '@/lib/dateUtils'

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null
  try {
    const d = parseISO(dateStr.replace(' ', 'T'))
    return isValid(d) ? d : null
  } catch { return null }
}

function parseDays(json: string, fallback: number[]): number[] {
  try {
    const r = JSON.parse(json)
    if (!Array.isArray(r)) return fallback
    return r
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => b - a)
  } catch {
    return fallback
  }
}

function buildReminderKey(vehicleId: string, type: Reminder['type']) {
  return `${vehicleId}:${type}`
}

function getMaxThreshold(thresholds: number[]) {
  return thresholds.length === 0 ? 0 : Math.max(...thresholds)
}

async function cleanAutoDuplicates(existing: Reminder[]) {
  const keep = new Map<string, Reminder>()
  const deleteIds: string[] = []

  for (const reminder of existing) {
    if (!reminder.is_auto || !reminder.reminder_key) continue
    const current = keep.get(reminder.reminder_key)
    if (!current) {
      keep.set(reminder.reminder_key, reminder)
      continue
    }

    const currentCreated = new Date(reminder.created_at).getTime()
    const keptCreated = new Date(current.created_at).getTime()
    if (currentCreated > keptCreated) {
      deleteIds.push(current.id)
      keep.set(reminder.reminder_key, reminder)
    } else {
      deleteIds.push(reminder.id)
    }
  }

  if (deleteIds.length > 0) {
    await Promise.all(deleteIds.map((id) => supabase.from('reminders').delete().eq('id', id)))
  }

  return existing.filter((r) => !deleteIds.includes(r.id))
}

async function upsertAutoReminder(
  userId: string,
  vehicleId: string,
  type: Reminder['type'],
  dueDate: Date,
  thresholds: number[],
  existing: Reminder[]
) {
  if (thresholds.length === 0) return
  const reminderKey = buildReminderKey(vehicleId, type)
  const same = existing.find((r) => r.is_auto && r.reminder_key === reminderKey)
  const maxThreshold = getMaxThreshold(thresholds)
  const record = {
    user_id: userId,
    vehicle_id: vehicleId,
    type,
    due_date: dueDate.toISOString(),
    status: 'pending',
    days_before: maxThreshold,
    is_auto: true,
    reminder_key: reminderKey,
    notified_thresholds: same?.due_date !== dueDate.toISOString() ? [] : same?.notified_thresholds || [],
  }

  try {
    if (!same) {
      const { error } = await supabase.from('reminders').insert(record)
      if (error) throw error
    } else {
      const { error } = await supabase.from('reminders').update(record).eq('id', same.id)
      if (error) throw error
    }
  } catch (err) {
    console.warn('Failed to upsert auto reminder:', err)
  }
}

async function removeAutoReminder(vehicleId: string, type: Reminder['type'], existing: Reminder[]) {
  const reminderKey = buildReminderKey(vehicleId, type)
  const same = existing.find((r) => r.is_auto && r.reminder_key === reminderKey)
  if (!same) return

  try {
    const { error } = await supabase.from('reminders').delete().eq('id', same.id)
    if (error) throw error
  } catch (err) {
    console.warn('Failed to delete auto reminder:', err)
  }
}

async function upsertAutoMileageReminder(
  userId: string,
  vehicleId: string,
  remainingKm: number,
  existing: Reminder[]
) {
  const reminderKey = buildReminderKey(vehicleId, 'mileage')
  const same = existing.find((r) => r.is_auto && r.reminder_key === reminderKey)
  const record = {
    user_id: userId,
    vehicle_id: vehicleId,
    type: 'mileage' as const,
    due_date: new Date().toISOString(),
    status: 'pending',
    days_before: remainingKm,
    is_auto: true,
    reminder_key: reminderKey,
    notified_thresholds: same?.notified_thresholds || [],
  }

  try {
    if (!same) {
      const { error } = await supabase.from('reminders').insert(record)
      if (error) throw error
    } else {
      const { error } = await supabase.from('reminders').update(record).eq('id', same.id)
      if (error) throw error
    }
  } catch (err) {
    console.warn('Failed to upsert mileage reminder:', err)
  }
}

export async function runAutoReminders(userId: string, vehicles: Vehicle[]) {
  if (!userId || vehicles.length === 0) return
  try {
    let settings: ReminderSettings | null = null
    try {
      const { data, error } = await supabase.from('reminder_settings').select('*').eq('user_id', userId).single()
      if (error && error.code !== 'PGRST116') throw error
      settings = data
    } catch (err) {
      console.warn('Failed to load reminder settings:', err)
    }

    const soatDays = parseDays(settings?.soat_days || '', [15, 7, 2])
    const techDays = parseDays(settings?.tech_review_days || '', [15, 7, 2])
    const extinDays = parseDays(settings?.extinguisher_days || '', [15])

    const { data: existingData, error: existingError } = await supabase.from('reminders').select('*').eq('user_id', userId)
    const existing = existingError ? [] : (existingData || [])
    const existingClean = await cleanAutoDuplicates(existing)

    const today = new Date(); today.setHours(0, 0, 0, 0)

    for (const v of vehicles) {
      const soatStatus = getDateStatus(v.soat_expiry)
      const soatDate = parseDate(v.soat_expiry)
      if (soatStatus.level !== 'valid' && soatDate) {
        await upsertAutoReminder(userId, v.id, 'soat', soatDate, soatDays, existingClean)
      } else {
        await removeAutoReminder(v.id, 'soat', existingClean)
      }

      const techStatus = getDateStatus(v.tech_review_next)
      const techDate = parseDate(v.tech_review_next)
      if (techStatus.level !== 'valid' && techDate) {
        await upsertAutoReminder(userId, v.id, 'tech_review', techDate, techDays, existingClean)
      } else {
        await removeAutoReminder(v.id, 'tech_review', existingClean)
      }

      const extinStatus = getDateStatus(v.extinguisher_renewal)
      const extinDate = parseDate(v.extinguisher_renewal)
      if (extinStatus.level !== 'valid') {
        const reminderDate = extinDate ?? new Date(today.getTime() - 24 * 60 * 60 * 1000)
        await upsertAutoReminder(userId, v.id, 'extinguisher', reminderDate, extinDays, existingClean)
      } else {
        await removeAutoReminder(v.id, 'extinguisher', existingClean)
      }

      const remaining = v.current_mileage !== undefined && v.next_mileage !== undefined
        ? v.next_mileage - v.current_mileage
        : undefined
      const alertKm = v.mileage_alert_km ?? null
      if (remaining !== undefined && alertKm !== null && remaining <= alertKm) {
        await upsertAutoMileageReminder(userId, v.id, remaining, existingClean)
      } else {
        await removeAutoReminder(v.id, 'mileage', existingClean)
      }
    }
  } catch (err) {
    console.error('Error in auto reminders:', err)
  }
}

export function useAutoReminders(userId: string | undefined, vehicles: Vehicle[]) {
  useEffect(() => {
    if (!userId || vehicles.length === 0) return
    runAutoReminders(userId, vehicles)
  }, [userId, vehicles])
}
