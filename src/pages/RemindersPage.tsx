import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Reminder, Vehicle } from '@/types'
import { formatDate, getDateStatus } from '@/lib/dateUtils'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import { Bell, Plus, Trash2, Loader2, Car } from 'lucide-react'
import toast from 'react-hot-toast'

const typeLabels = { soat: 'SOAT', tech_review: 'Rev. Técnica', mileage: 'Kilometraje', extinguisher: 'Extintor' }

export default function RemindersPage() {
  const user = useAuthStore((s) => s.user)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    if (!user) return
    try {
      const [remindersRes, vehiclesRes] = await Promise.all([
        supabase.from('reminders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').eq('user_id', user.id).order('plate_number', { ascending: true }),
      ])
      if (remindersRes.error) throw remindersRes.error
      if (vehiclesRes.error) throw vehiclesRes.error

      const reminderData = remindersRes.data || []
      const sentReminders = reminderData.filter(r => r.status === 'sent')
      if (sentReminders.length > 0) {
        await Promise.all(
          sentReminders.map(r =>
            supabase.from('reminders').update({ status: 'pending' }).eq('id', r.id).then(res => {
              if (res.error) console.warn('Failed to update reminder status:', res.error)
            })
          )
        )
        reminderData.forEach(r => {
          const sent = sentReminders.find(s => s.id === r.id)
          if (sent) r.status = 'pending'
        })
      }

      setReminders(reminderData)
      setVehicles(vehiclesRes.data || [])
    } catch (err) {
      console.warn('Failed to load reminders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Recordatorio eliminado')
      setDeleteId(null)
      await load()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      const { error } = await supabase.from('reminders').update({ status: 'dismissed' }).eq('id', id)
      if (error) throw error
      await load()
    } catch {
      toast.error('Error')
    }
  }

  const pending = reminders.filter((r) => r.status !== 'dismissed')
  const dismissed = reminders.filter((r) => r.status === 'dismissed')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Recordatorios</h1>
          <p className="text-slate-400 text-sm mt-0.5">{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</p>
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">Las notificaciones del navegador se muestran cuando el navegador tiene permiso.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={16} /> Nuevo</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sin recordatorios"
          description="Crea recordatorios para recibir alertas sobre vencimientos y mantenimientos."
          action={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={15} /> Crear recordatorio</button>}
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="section-title mb-3">Pendientes</h2>
              <div className="space-y-3">
                {pending.map((r) => <ReminderRow key={r.id} reminder={r} vehicles={vehicles} onDelete={() => setDeleteId(r.id)} onDismiss={() => handleDismiss(r.id)} />)}
              </div>
            </div>
          )}
          {dismissed.length > 0 && (
            <div>
              <h2 className="section-title mb-3 text-slate-400">Descartados</h2>
              <div className="space-y-3 opacity-60">
                {dismissed.map((r) => <ReminderRow key={r.id} reminder={r} vehicles={vehicles} onDelete={() => setDeleteId(r.id)} onDismiss={() => {}} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <AddReminderModal open={addOpen} onClose={() => setAddOpen(false)} vehicles={vehicles} userId={user?.id || ''} onAdded={load} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} title="¿Eliminar recordatorio?" message="Esta acción no se puede deshacer." />
    </div>
  )
}

function ReminderRow({ reminder: r, vehicles, onDelete, onDismiss }: { reminder: Reminder; vehicles: Vehicle[]; onDelete: () => void; onDismiss: () => void }) {
  const vehicle = vehicles.find((v) => v.id === r.vehicle_id)
  const dueDateStatus = getDateStatus(r.due_date)
  const notificationVehicle = vehicle?.plate_number || 'Sin placa'

  const handleBrowserNotify = () => {
    if (!('Notification' in window)) {
      toast.error('Notificaciones del navegador no disponibles')
      return
    }
    const bodyText = r.type === 'mileage'
      ? `Revisar el kilometraje de ${notificationVehicle}: ${vehicle?.model ?? 'sin modelo'}. ${formatDate(r.due_date)}`
      : `${typeLabels[r.type]} para ${notificationVehicle} vence ${formatDate(r.due_date)}`

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(`Recordatorio ${typeLabels[r.type]}`, {
            body: bodyText,
          })
        } else {
          toast.error('Permite notificaciones en el navegador')
        }
      })
      return
    }
    if (Notification.permission === 'granted') {
      new Notification(`Recordatorio ${typeLabels[r.type]}`, {
        body: bodyText,
      })
    } else {
      toast.error('Permite notificaciones en el navegador')
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <Bell size={16} className="text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-slate-800">{typeLabels[r.type]}</span>
            {vehicle && (
              <span className="flex items-center gap-1 text-xs text-slate-700 bg-cream-100 px-2 py-0.5 rounded-full">
                <Car size={10} /> {vehicle.plate_number}
              </span>
            )}
            <StatusBadge status={dueDateStatus} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Vence: {formatDate(r.due_date)}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Bell size={11} /> Navegador</span>
            <span>·</span>
            <span>{dueDateStatus.daysRemaining === 0 ? 'Hoy se vence' : dueDateStatus.daysRemaining !== undefined && dueDateStatus.daysRemaining < 0 ? 'Vencido' : dueDateStatus.daysRemaining !== undefined ? `${dueDateStatus.daysRemaining}d antes` : `${r.days_before}d antes`}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleBrowserNotify} className="btn-secondary text-xs px-2 py-1">
              Probar notificación
            </button>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {r.status === 'pending' && (
            <button onClick={onDismiss} className="btn-ghost text-xs py-1 px-2">Descartar</button>
          )}
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

function AddReminderModal({ open, onClose, vehicles, userId, onAdded }: {
  open: boolean; onClose: () => void; vehicles: Vehicle[]; userId: string; onAdded: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    vehicle_id: '', type: 'soat' as 'soat' | 'tech_review' | 'mileage' | 'extinguisher',
    due_date: '', days_before: '7',
  })

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vehicle_id) {
      toast.error('Selecciona un vehículo')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('reminders').insert({
        user_id: userId,
        vehicle_id: form.vehicle_id,
        type: form.type,
        due_date: form.due_date,
        status: 'pending',
        days_before: Number(form.days_before),
      })
      if (error) throw error
      toast.success('Recordatorio creado')
      onClose()
      setForm({ vehicle_id: '', type: 'soat', due_date: '', days_before: '7' })
      onAdded()
    } catch (err: any) {
      console.error('Error creating reminder:', err)
      toast.error(`Error al crear: ${err.message || 'Desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo recordatorio" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="label">Vehículo <span className="text-red-500">*</span></label>
          <select className="input" value={form.vehicle_id} onChange={(e) => set('vehicle_id', e.target.value)} required>
            <option value="">Seleccionar...</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as typeof form.type)}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha de vencimiento</label>
            <input type="date" className="input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Días de anticipación</label>
          <input type="number" className="input" value={form.days_before} onChange={(e) => set('days_before', e.target.value)} min={1} max={90} />
        </div>
        <p className="text-xs text-slate-500">Se enviará una notificación del navegador cuando el recordatorio sea válido.</p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading && <Loader2 size={14} className="animate-spin" />} Crear
          </button>
        </div>
      </form>
    </Modal>
  )
}
