import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Observation } from '@/types'
import { MessageSquare, Plus, Check, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ObservationsPanel() {
  const user = useAuthStore((s) => s.user)
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const load = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('observations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setObservations(data || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const handleAdd = async () => {
    if (!newContent.trim() || !user) return
    setAdding(true)
    try {
      const { error } = await supabase.from('observations').insert({ user_id: user.id, content: newContent.trim(), resolved: false })
      if (error) throw error
      setNewContent('')
      await load()
      toast.success('Observación agregada')
    } catch {
      toast.error('Error al agregar')
    } finally {
      setAdding(false)
    }
  }

  const handleToggleResolved = async (obs: Observation) => {
    try {
      const { error } = await supabase.from('observations').update({
        resolved: !obs.resolved,
        resolved_at: !obs.resolved ? new Date().toISOString() : null,
      }).eq('id', obs.id)
      if (error) throw error
      await load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('observations').delete().eq('id', id)
      if (error) throw error
      await load()
      toast.success('Eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleEdit = async (id: string) => {
    try {
      const { error } = await supabase.from('observations').update({ content: editContent }).eq('id', id)
      if (error) throw error
      setEditingId(null)
      await load()
      toast.success('Actualizada')
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const pending = observations.filter((o) => !o.resolved)
  const resolved = observations.filter((o) => o.resolved)

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-brand-600" />
        <h2 className="section-title">Observaciones</h2>
        {pending.length > 0 && (
          <span className="badge bg-amber-50 text-amber-700 border border-amber-200 ml-auto">
            {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-4">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="input flex-1 text-sm"
          placeholder="Nueva observación..."
        />
        <button onClick={handleAdd} disabled={adding || !newContent.trim()} className="btn-primary px-3">
          {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
      ) : observations.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">Sin observaciones registradas</p>
      ) : (
        <div className="space-y-2">
          {pending.map((obs) => (
            <ObsRow
              key={obs.id} obs={obs}
              editingId={editingId} editContent={editContent}
              setEditingId={setEditingId} setEditContent={setEditContent}
              onToggle={handleToggleResolved} onDelete={handleDelete} onEdit={handleEdit}
            />
          ))}
          {resolved.length > 0 && (
            <>
              <p className="text-xs text-slate-400 pt-2 pb-1 font-medium">Resueltas</p>
              {resolved.map((obs) => (
                <ObsRow
                  key={obs.id} obs={obs}
                  editingId={editingId} editContent={editContent}
                  setEditingId={setEditingId} setEditContent={setEditContent}
                  onToggle={handleToggleResolved} onDelete={handleDelete} onEdit={handleEdit}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ObsRow({ obs, editingId, editContent, setEditingId, setEditContent, onToggle, onDelete, onEdit }: {
  obs: Observation
  editingId: string | null
  editContent: string
  setEditingId: (id: string | null) => void
  setEditContent: (v: string) => void
  onToggle: (o: Observation) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const isEditing = editingId === obs.id

  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-xl border transition-all', obs.resolved ? 'bg-cream-100 border-cream-200 opacity-60' : 'bg-cream-100 border-cream-200')}>
      <button onClick={() => onToggle(obs)} className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors', obs.resolved ? 'bg-brand-600 border-brand-600' : 'border-cream-300 hover:border-brand-700')}>
        {obs.resolved && <Check size={10} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-2">
            <input value={editContent} onChange={(e) => setEditContent(e.target.value)} className="input flex-1 text-sm py-1" autoFocus onKeyDown={(e) => e.key === 'Enter' && onEdit(obs.id)} />
            <button onClick={() => onEdit(obs.id)} className="text-brand-600 hover:text-brand-700 p-1"><Check size={14} /></button>
            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={14} /></button>
          </div>
        ) : (
          <>
            <p className={clsx('text-sm', obs.resolved ? 'line-through text-slate-400' : 'text-slate-700')}>{obs.content}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {format(parseISO(obs.created_at.replace(' ', 'T')), 'dd MMM yyyy', { locale: es })}
            </p>
          </>
        )}
      </div>
      {!isEditing && (
        <div className="flex gap-1">
          <button onClick={() => { setEditingId(obs.id); setEditContent(obs.content) }} className="p-1.5 hover:bg-cream-200 rounded-lg text-slate-500 hover:text-brand-700 transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(obs.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
