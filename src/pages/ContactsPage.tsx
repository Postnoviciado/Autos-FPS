import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Contact } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Users, Plus, Phone, Mail, MapPin, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const typeLabels = { provider: 'Proveedor', workshop: 'Taller', mechanic: 'Mecánico', responsable: 'Responsable' }
const typeColors = {
  provider: 'bg-cream-100 text-brand-700 border-cream-200',
  workshop: 'bg-brand-50 text-brand-700 border-brand-100',
  mechanic: 'bg-amber-50 text-amber-700 border-amber-100',
  responsable: 'bg-cream-100 text-brand-700 border-cream-200',
}

const emptyForm = { name: '', type: 'workshop' as Contact['type'], phone: '', email: '', address: '', notes: '' }

export default function ContactsPage() {
  const user = useAuthStore(s => s.user)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<Contact['type'] | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).neq('type', 'responsable').order('name', { ascending: true })
      if (error) throw error
      setContacts(data || [])
    } catch (err) {
      console.warn('Failed to load contacts:', err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (c: Contact) => {
    setEditing(c)
    setForm({ name: c.name, type: c.type, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSaving(true)
    try {
      const data = { ...form, user_id: user.id }
      if (editing) {
        const { error } = await supabase.from('contacts').update(data).eq('id', editing.id)
        if (error) throw error
        toast.success('Contacto actualizado')
      } else {
        const { error } = await supabase.from('contacts').insert(data)
        if (error) throw error
        toast.success('Contacto agregado')
      }
      setModalOpen(false)
      await load()
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Contacto eliminado')
      setDeleteId(null)
      await load()
    } catch { toast.error('Error al eliminar') } finally { setDeleting(false) }
  }

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) || (c.email || '').toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || c.type === filterType
    return matchSearch && matchType
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Contactos</h1>
          <p className="text-slate-400 text-sm mt-0.5">Talleres, mecánicos y proveedores</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Agregar contacto
        </button>
      </div>

      {/* Filtros */}
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm w-56" placeholder="Buscar..." />
          </div>
          <div className="flex gap-1">
            {(['all', 'workshop', 'mechanic', 'provider'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={clsx('px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
                  filterType === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-cream-100 text-slate-900 border-cream-200 hover:border-cream-300'
                )}>
                {t === 'all' ? 'Todos' : typeLabels[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={search || filterType !== 'all' ? 'Sin resultados' : 'Sin contactos'}
          description={search || filterType !== 'all' ? 'Prueba con otra búsqueda.' : 'Agrega talleres, mecánicos y proveedores.'}
          action={!search && filterType === 'all' ? <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Agregar contacto</button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="card p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{c.name}</h3>
                  <span className={clsx('badge text-xs mt-1', typeColors[c.type])}>
                    {typeLabels[c.type]}
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-cream-200 rounded-lg text-slate-500 hover:text-brand-700 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                {c.phone && <div className="flex items-center gap-2"><Phone size={11} className="text-slate-400 flex-shrink-0" /><a href={`tel:${c.phone}`} className="hover:text-brand-600">{c.phone}</a></div>}
                {c.email && <div className="flex items-center gap-2"><Mail size={11} className="text-slate-400 flex-shrink-0" /><a href={`mailto:${c.email}`} className="hover:text-brand-600 truncate">{c.email}</a></div>}
                {c.address && <div className="flex items-center gap-2"><MapPin size={11} className="text-slate-400 flex-shrink-0" /><span className="truncate">{c.address}</span></div>}
                {c.notes && <p className="text-slate-400 mt-2 italic truncate">"{c.notes}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal agregar/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar contacto' : 'Nuevo contacto'} size="md">
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del taller o mecánico" required />
          </div>
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['workshop', 'mechanic', 'provider'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={clsx('p-2.5 rounded-xl border-2 text-center text-xs font-medium transition-all',
                    form.type === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-cream-200 text-slate-800 hover:border-cream-300'
                  )}>
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+51 999 999 999" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
            </div>
          </div>
          <div>
            <label className="label">Dirección</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Dirección del taller" />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none text-sm" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Especialidad, horario, referencia..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editing ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        loading={deleting} title="¿Eliminar contacto?" message="Esta acción no se puede deshacer." confirmLabel="Eliminar" />
    </div>
  )
}
