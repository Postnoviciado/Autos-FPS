import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { askNotificationPermission } from '@/hooks/useReminderNotifications'
import type { ReminderSettings, Vehicle } from '@/types'
import { Settings, Loader2, Save, Bell, Info } from 'lucide-react'
import toast from 'react-hot-toast'

function parseDays(json: string, fallback: number[]): number[] {
  try { const r = JSON.parse(json); return Array.isArray(r) ? r : fallback } catch { return fallback }
}

type VehicleAlertRow = Pick<Vehicle, 'id' | 'plate_number' | 'brand' | 'model'> & { mileage_alert_km: number | null, daily_km: number | null }

export default function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const [remSettings, setRemSettings] = useState<ReminderSettings | null>(null)
  const [vehicles, setVehicles] = useState<VehicleAlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingRem, setSavingRem] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
  })
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default')
  const [notifLoading, setNotifLoading] = useState(false)

  // Días editables como strings para los inputs
  const [remForm, setRemForm] = useState({
    soat_days: '15, 7, 2',
    tech_review_days: '15, 7, 2',
    extinguisher_days: '15',
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
    } else {
      setNotificationPermission('unsupported')
    }

    if (!user) return
    const loadSettings = async () => {
      try {
        setForm({ name: user.user_metadata?.name || '', email: user.email || '' })
        const rRes = await supabase.from('reminder_settings').select('*').eq('user_id', user.id).single()
        const r = rRes.error?.code === 'PGRST116' ? null : rRes.data
        if (r) {
          setRemSettings(r)
          setRemForm({
            soat_days: parseDays(r.soat_days, [15, 7, 2]).join(', '),
            tech_review_days: parseDays(r.tech_review_days, [15, 7, 2]).join(', '),
            extinguisher_days: parseDays(r.extinguisher_days, [15]).join(', '),
          })
        }

        const vehiclesRes = await supabase.from('vehicles')
          .select('id, plate_number, brand, model, mileage_alert_km, daily_km')
          .eq('user_id', user.id)
          .order('plate_number', { ascending: true })

        if (vehiclesRes.error) throw vehiclesRes.error
        setVehicles((vehiclesRes.data || []) as VehicleAlertRow[])
      } catch (err) {
        console.error('Error loading settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son obligatorios')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: form.email, data: { name: form.name } })
      if (error) throw error
      toast.success('Perfil actualizado')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg.slice(0, 80)}`)
    } finally { setSaving(false) }
  }

  const parseDaysInput = (str: string): number[] => {
    return str.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0).sort((a, b) => b - a)
  }

  const handleVehicleAlertChange = (id: string, value: string, field: 'mileage_alert_km' | 'daily_km' = 'mileage_alert_km') => {
    const parsed = parseInt(value, 10)
    setVehicles((current) => current.map((vehicle) => (
      vehicle.id === id
        ? { ...vehicle, [field]: Number.isNaN(parsed) ? null : parsed }
        : vehicle
    )))
  }

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador no admite notificaciones web.')
      return
    }

    setNotifLoading(true)
    try {
      const granted = await askNotificationPermission()
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
      if (granted) {
        toast.success('Notificaciones habilitadas.')
      } else if (Notification.permission === 'denied') {
        toast.error('Debes permitir las notificaciones en el navegador para recibir alertas.')
      } else {
        toast('Solicitud de notificaciones cancelada.', { icon: '🔔' })
      }
    } catch (err) {
      console.error('Error solicitando permiso de notificaciones:', err)
      toast.error('No se pudo solicitar el permiso de notificaciones.')
    } finally {
      setNotifLoading(false)
    }
  }

  const handleSaveReminders = async () => {
    if (!user) return
    setSavingRem(true)
    try {
      const data = {
        user_id: user.id,
        soat_days: JSON.stringify(parseDaysInput(remForm.soat_days)),
        tech_review_days: JSON.stringify(parseDaysInput(remForm.tech_review_days)),
        extinguisher_days: JSON.stringify(parseDaysInput(remForm.extinguisher_days)),
      }
      if (remSettings) {
        const { error } = await supabase.from('reminder_settings').update(data).eq('id', remSettings.id)
        if (error) throw error
      } else {
        const { data: newSettings, error } = await supabase.from('reminder_settings').insert(data).select().single()
        if (error) throw error
        setRemSettings(newSettings)
      }

      // Try updating both mileage alert and daily_km. If DB doesn't have daily_km column, retry without it.
      const buildUpdate = (v: typeof vehicles[number], includeDaily: boolean) => (
        includeDaily
          ? supabase.from('vehicles').update({ mileage_alert_km: v.mileage_alert_km ?? null, daily_km: v.daily_km ?? null }).eq('id', v.id)
          : supabase.from('vehicles').update({ mileage_alert_km: v.mileage_alert_km ?? null }).eq('id', v.id)
      )

      let results = await Promise.all(vehicles.map((v) => buildUpdate(v, true)))
      let updateError = results.find((result) => result.error)
      if (updateError?.error) {
        // If daily_km column missing, retry without it
        const errMsg = String(updateError.error.message || updateError.error)
        if (errMsg.toLowerCase().includes('daily_km') || errMsg.toLowerCase().includes('column "daily_km"')) {
          results = await Promise.all(vehicles.map((v) => buildUpdate(v, false)))
          const retryError = results.find((r) => r.error)
          if (retryError?.error) throw retryError.error
          toast('La columna `daily_km` no existe en la base de datos. Se han guardado solo los avisos de kilómetro. Ejecuta la migración para habilitar Km diarios.', { icon: '⚠️' })
        } else {
          throw updateError.error
        }
      }

      toast.success('Recordatorios y avisos de kilómetro guardados')
    } catch (err) {
      console.error('Error saving reminders:', err)
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg.slice(0, 100)}`)
    } finally {
      setSavingRem(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-brand-600" />
        <h1 className="page-title">Configuración</h1>
      </div>

      {/* Mi cuenta */}
      <form onSubmit={handleSaveProfile} className="card p-6 space-y-5">
        <h2 className="section-title mb-4">Mi cuenta</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold">
            {form.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{form.name || 'Sin nombre'}</p>
            <p className="text-slate-400 text-sm">{form.email}</p>
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <div>
            <label className="label">Nombre <span className="text-red-500">*</span></label>
            <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tu nombre" required />
          </div>
          <div>
            <label className="label">Correo electrónico <span className="text-red-500">*</span></label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="tu@email.com" required />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar perfil
          </button>
        </div>
      </form>

      {/* Notificaciones */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-brand-600" />
          <h2 className="section-title">Notificaciones</h2>
        </div>
        <p className="text-sm text-slate-600">Activa las notificaciones del navegador para recibir alertas en la app. En móviles, esto funciona mejor desde un origen seguro (HTTPS).</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
          <div>
            <p className="text-sm font-medium text-slate-900">Estado actual</p>
            <p className="text-xs text-slate-500">
              {notificationPermission === 'granted' && 'Habilitado'}
              {notificationPermission === 'denied' && 'Denegado - habilítalo en la configuración del navegador'}
              {notificationPermission === 'default' && 'No solicitado'}
              {notificationPermission === 'unsupported' && 'No soportado en este navegador'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={notifLoading || notificationPermission === 'granted'}
            className="btn-primary inline-flex items-center justify-center"
          >
            {notifLoading ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
            {notificationPermission === 'granted' ? 'Activado' : 'Activar notificaciones'}
          </button>
        </div>
        <p className="text-xs text-slate-400">Si el navegador no aparece en la configuración de notificaciones, intenta con una URL HTTPS o usa el sitio desplegado en Vercel.</p>
      </div>

      {/* Días de recordatorios automáticos */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-brand-600" />
          <h2 className="section-title">Recordatorios automáticos</h2>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 border border-brand-100 text-xs text-brand-700">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          Ingresa los días antes del vencimiento separados por coma. Ej: <strong>15, 7, 2</strong>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">SOAT — días de anticipación</label>
            <input className="input" value={remForm.soat_days}
              onChange={e => setRemForm(f => ({ ...f, soat_days: e.target.value }))}
              placeholder="15, 7, 2" />
            <p className="text-xs text-slate-400 mt-1">Predeterminado: 15 días, 7 días y 2 días antes</p>
          </div>
          <div>
            <label className="label">Revisión técnica — días de anticipación</label>
            <input className="input" value={remForm.tech_review_days}
              onChange={e => setRemForm(f => ({ ...f, tech_review_days: e.target.value }))}
              placeholder="15, 7, 2" />
            <p className="text-xs text-slate-400 mt-1">Predeterminado: 15 días, 7 días y 2 días antes</p>
          </div>
          <div>
            <label className="label">Extintor — días de anticipación</label>
            <input className="input" value={remForm.extinguisher_days}
              onChange={e => setRemForm(f => ({ ...f, extinguisher_days: e.target.value }))}
              placeholder="15" />
            <p className="text-xs text-slate-400 mt-1">Predeterminado: 15 días antes</p>
          </div>
          <div className="pt-1 border-t border-cream-100">
            <p className="text-xs font-medium text-slate-600 mb-1">Kilometraje — por vehículo</p>
            <p className="text-xs text-slate-400">Ajusta el aviso de kilometraje para cada vehículo directamente desde aquí y guarda todo con el mismo botón.</p>
          </div>

          {vehicles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No hay vehículos registrados. Agrega vehículos primero en la sección Vehículos.
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{vehicle.plate_number}</p>
                      <p className="text-xs text-slate-500">{vehicle.brand ?? ''}{vehicle.brand && vehicle.model ? ' · ' : ''}{vehicle.model ?? ''}</p>
                    </div>
                                <div className="w-full sm:w-44 grid grid-cols-1 gap-2">
                                  <div>
                                    <label className="label">Avisar cuando falten (km)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      className="input"
                                      value={vehicle.mileage_alert_km ?? ''}
                                      placeholder="500"
                                      onChange={(e) => handleVehicleAlertChange(vehicle.id, e.target.value, 'mileage_alert_km')}
                                    />
                                  </div>
                                  <div>
                                    <label className="label">Km diarios (suma diaria)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      className="input"
                                      value={vehicle.daily_km ?? ''}
                                      placeholder="0"
                                      onChange={(e) => handleVehicleAlertChange(vehicle.id, e.target.value, 'daily_km')}
                                    />
                                  </div>
                                </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveReminders} disabled={savingRem} className="btn-primary">
            {savingRem ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar recordatorios
          </button>
        </div>
      </div>

    </div>
  )
}
