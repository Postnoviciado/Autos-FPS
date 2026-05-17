export interface User {
  id: string
  email: string
  user_metadata?: {
    name?: string
  }
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  user_id: string
  plate_number: string
  brand?: string
  model?: string
  manufacture_year: number
  soat_expiry?: string
  tech_review_last?: string
  tech_review_next?: string
  air_pressure?: number
  extinguisher_renewal?: string
  current_mileage?: number
  next_mileage?: number
  daily_km?: number
  photo?: string
  property_card?: string
  mileage_alert_km?: number
  created_at: string
  updated_at: string
}

export interface Maintenance {
  id: string
  vehicle_id: string
  type: 'regular' | 'additional'
  date: string
  performed_by: string
  location: string
  services?: string[]
  current_mileage?: number
  next_mileage?: number
  notes?: string
  receipt_photo?: string
  detail_photo?: string
  created_at: string
}

export interface Observation {
  id: string
  user_id: string
  content: string
  resolved: boolean
  resolved_at?: string
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  vehicle_id: string
  type: 'soat' | 'tech_review' | 'mileage' | 'extinguisher'
  due_date: string
  status: 'pending' | 'sent' | 'dismissed'
  days_before: number
  is_auto?: boolean
  reminder_key?: string
  notified_thresholds?: number[]
  last_notified_at?: string
  created_at: string
}

export interface ReminderSettings {
  id: string
  user_id: string
  soat_days: string        // JSON array e.g. "[15,7,2]"
  tech_review_days: string // JSON array e.g. "[15,7,2]"
  extinguisher_days: string // JSON array e.g. "[15]"
  created_at: string
  updated_at: string
}

export interface BackupData {
  version: string
  user_id: string
  timestamp: string
  vehicles: Vehicle[]
  maintenances: Maintenance[]
  observations: Observation[]
  reminders: Reminder[]
  reminder_settings: ReminderSettings | null
  contacts: Contact[]
}

export interface Contact {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  type: 'provider' | 'workshop' | 'mechanic' | 'responsable'
  address?: string
  notes?: string
  receive_notifications?: boolean
  created_at: string
  updated_at: string
}

export type StatusLevel = 'expired' | 'urgent' | 'upcoming' | 'valid' | 'none'

export interface DateStatus {
  level: StatusLevel
  label: string
  daysRemaining?: number
}
