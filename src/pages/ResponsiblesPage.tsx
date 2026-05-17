import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Contact } from '@/types'
import { Users, Plus, Edit2, Trash2, Loader2, MessageSquare, MapPin, Check } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const emptyForm = { name: '', phone: '', address: '', notes: '' }

export default function ResponsiblesPage() {
  const user = useAuthStore(s => s.user)
  const [responsables, setResponsables] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).eq('type', 'responsable').order('name', { ascending: true })
      if (error) throw error
      setResponsables(data || [])
    } catch (err) {
      console.warn('Failed to load responsables:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      notes: c.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      const data = {
        user_id: user.id,
        name: form.name.trim(),
        type: 'responsable',
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      }

      if (editing) {
        const { error } = await supabase.from('contacts').update(data).eq('id', editing.id)
        if (error) throw error
        toast.success('Responsable actualizado')
      } else {
        const { error } = await supabase.from('contacts').insert(data)
        if (error) throw error
        toast.success('Responsable agregado')
      }
      setModalOpen(false)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg.slice(0, 80)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Responsable eliminado')
      setDeleteId(null)
      await load()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Responsables de notificaciones</h1>
          <p className="text-slate-400 text-sm mt-0.5">{responsables.length} responsable{responsables.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Agregar</button>
      </div>

      {responsables.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin responsables"
          description="Agrega responsables para enviarles notificaciones automáticas de recordatorios."
          action={<button onClick={openAdd} className="btn-primary"><Plus size={15} /> Agregar responsable</button>}
        />
      ) : (
        <div className="space-y-3">
          {responsables.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-slate-800">{r.name}</span>
                    {r.receive_notifications && (
                      <span className="flex items-center gap-1 text-xs text-brand-700 bg-cream-100 px-2 py-0.5 rounded-full">
                        <Check size={10} /> Activo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {r.phone && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={11} /> {r.phone}
                      </span>
                    )}
                    {r.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {r.address}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-xs text-slate-400 mt-1">📝 {r.notes}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-cream-200 rounded-lg text-slate-500 hover:text-brand-700 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDeleteId(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar responsable' : 'Nuevo responsable'} size="sm">
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Pérez" required />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="label">Celular (WhatsApp)</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+51 999 999 999" />
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección del responsable" />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Especialidad, horario, referencia..." rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} title="¿Eliminar responsable?" message="Esta acción no se puede deshacer." />
    </div>
  )
}
