import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle, Contact } from '@/types'
import PhotoUploadField from '@/components/ui/PhotoUploadField'
import toast from 'react-hot-toast'

interface Props {
  vehicle: Vehicle
  onDone: () => void
  onCancel: () => void
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateToISO(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`
}

export default function AddMaintenanceInline({ vehicle, onDone, onCancel }: Props) {
  const user = useAuthStore(s => s.user)
  const [loading, setLoading] = useState(false)
  const [newService, setNewService] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [detailFile, setDetailFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | undefined>()
  const [detailPreview, setDetailPreview] = useState<string | undefined>()
  const [receiptPreviewType, setReceiptPreviewType] = useState<'image' | 'pdf'>('image')
  const [detailPreviewType, setDetailPreviewType] = useState<'image' | 'pdf'>('image')

  const getPreviewType = (file: File | null) => {
    if (!file) return 'image'
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
  }

  const [form, setForm] = useState({
    type: 'regular' as 'regular' | 'additional',
    date: todayLocal(),
    performed_by: '',
    location: '',
    current_mileage: vehicle.current_mileage?.toString() || '',
    next_mileage: vehicle.next_mileage?.toString() || '',
    notes: '',
    services: [] as string[],
  })

  const set = (key: keyof typeof form, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    if (!user) return
    const loadContacts = async () => {
      try {
        const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name', { ascending: true })
        if (error) throw error
        setContacts(data || [])
      } catch (err: any) {
        console.error('Error loading contacts:', err)
      }
    }
    loadContacts()
  }, [user])

  const workshopContacts = contacts.filter(c => c.type === 'workshop' || c.type === 'mechanic')
  const filteredContacts = form.location.length > 0
    ? workshopContacts.filter(c => c.name.toLowerCase().includes(form.location.toLowerCase()))
    : workshopContacts

  const handleMileageChange = (val: string) => {
    set('current_mileage', val)
    if (form.type === 'regular' && val) set('next_mileage', (Number(val) + 5000).toString())
  }

  const handleTypeChange = (t: 'regular' | 'additional') => {
    set('type', t)
    if (t === 'regular' && form.current_mileage) set('next_mileage', (Number(form.current_mileage) + 5000).toString())
  }

  const addService = () => {
    if (!newService.trim()) return
    set('services', [...form.services, newService.trim()])
    setNewService('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let receiptPhotoPath: string | null = null
      let detailPhotoPath: string | null = null

      // Upload receipt photo if provided
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop() || 'jpg'
        const fileName = `maintenance_receipt_${Date.now()}_${vehicle.id}.${ext}`
        const { data, error } = await supabase.storage.from('maintenance').upload(`${vehicle.id}/${fileName}`, receiptFile)
        if (error) throw error
        receiptPhotoPath = data?.path || null
      }

      // Upload detail photo if provided
      if (detailFile) {
        const ext = detailFile.name.split('.').pop() || 'jpg'
        const fileName = `maintenance_detail_${Date.now()}_${vehicle.id}.${ext}`
        const { data, error } = await supabase.storage.from('maintenance').upload(`${vehicle.id}/${fileName}`, detailFile)
        if (error) throw error
        detailPhotoPath = data?.path || null
      }

      const { error: insertError } = await supabase.from('maintenance').insert({
        vehicle_id: vehicle.id,
        type: form.type,
        date: dateToISO(form.date),
        performed_by: form.performed_by || '',
        location: form.location || '',
        notes: form.notes || '',
        services: form.services,
        current_mileage: form.current_mileage ? Number(form.current_mileage) : null,
        next_mileage: form.next_mileage ? Number(form.next_mileage) : null,
        receipt_photo: receiptPhotoPath,
        detail_photo: detailPhotoPath,
      })
      if (insertError) throw insertError

      if (form.type === 'regular' && form.current_mileage) {
        const { error: updateError } = await supabase.from('vehicles').update({
          current_mileage: Number(form.current_mileage),
          next_mileage: form.next_mileage ? Number(form.next_mileage) : null,
        }).eq('id', vehicle.id)
        if (updateError) throw updateError
      }
      toast.success('Mantenimiento registrado')
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error guardando mantenimiento:', err)
      toast.error(`Error: ${msg.slice(0, 80)}`)
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={onCancel} className="btn-ghost p-1.5"><ArrowLeft size={16} /></button>
        <div>
          <h3 className="font-display font-semibold text-slate-900">Nuevo mantenimiento</h3>
          <p className="text-xs text-slate-400">{vehicle.plate_number}</p>
        </div>
      </div>

      {/* Tipo */}
      <div className="grid grid-cols-2 gap-2">
        {(['regular', 'additional'] as const).map(t => (
          <button key={t} type="button" onClick={() => handleTypeChange(t)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === t ? 'border-brand-500 bg-brand-50' : 'border-cream-200 hover:border-cream-300'}`}>
            <p className={`font-semibold text-xs ${form.type === t ? 'text-brand-700' : 'text-slate-900'}`}>
              {t === 'regular' ? '🔄 Regular' : '⚡ Adicional'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{t === 'regular' ? 'Cada 5,000 km' : 'Reparación extra'}</p>
          </button>
        ))}
      </div>

      {/* Campos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Fecha <span className="text-red-500">*</span></label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label">Llevado por</label>
          <input className="input" value={form.performed_by} onChange={e => set('performed_by', e.target.value)} placeholder="Nombre del hermano" />
        </div>
        {/* Taller con sugerencias */}
        <div className="col-span-2 relative">
          <label className="label">Taller / Mecánico</label>
          <input className="input" value={form.location}
            onChange={e => { set('location', e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Nombre del taller o mecánico"
            autoComplete="off"
          />
          {showSuggestions && filteredContacts.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-cream-50 border border-cream-200 rounded-xl shadow-lg overflow-hidden">
              <p className="text-xs text-slate-600 px-3 py-1.5 border-b border-cream-100">Contactos guardados</p>
              {filteredContacts.slice(0, 5).map(c => (
                <button key={c.id} type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-cream-100 text-left"
                  onMouseDown={() => { set('location', c.name); setShowSuggestions(false) }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.type === 'workshop' ? 'Taller' : 'Mecánico'}{c.phone ? ` · ${c.phone}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {form.type === 'regular' && (
          <>
            <div>
              <label className="label">Km actual</label>
              <input type="number" className="input" value={form.current_mileage} onChange={e => handleMileageChange(e.target.value)} placeholder="km" min={0} />
            </div>
            <div>
              <label className="label">Próximo (km)</label>
              <input type="number" className="input bg-cream-100 text-slate-600 cursor-not-allowed" value={form.next_mileage} readOnly />
            </div>
          </>
        )}
      </div>

      {/* Servicios */}
      <div>
        <label className="label">Servicios realizados</label>
        <div className="flex gap-2 mb-2">
          <input className="input flex-1 text-sm" value={newService}
            onChange={e => setNewService(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService() } }}
            placeholder="Ej: Cambio de aceite..." />
          <button type="button" onClick={addService} className="btn-secondary px-3"><Plus size={14} /></button>
        </div>
        {form.services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.services.map((s, i) => (
              <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-xs">
                {s}
                <button type="button" onClick={() => set('services', form.services.filter((_, idx) => idx !== i))}
                  className="hover:text-red-500 ml-0.5"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Fotos */}
      <div className="grid grid-cols-2 gap-3">
        <PhotoUploadField
          label="Boleta de pago"
          previewUrl={receiptPreview}
          previewType={receiptPreviewType}
          onFileSelected={f => {
            setReceiptFile(f)
            setReceiptPreview(f ? URL.createObjectURL(f) : undefined)
            setReceiptPreviewType(getPreviewType(f))
          }}
          compact
        />
        <PhotoUploadField
          label="Detalle del mantenimiento"
          previewUrl={detailPreview}
          previewType={detailPreviewType}
          onFileSelected={f => {
            setDetailFile(f)
            setDetailPreview(f ? URL.createObjectURL(f) : undefined)
            setDetailPreviewType(getPreviewType(f))
          }}
          compact
        />
      </div>

      {/* Notas */}
      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none text-sm" rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Observaciones adicionales..." />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
          {loading && <Loader2 size={14} className="animate-spin" />} Registrar
        </button>
      </div>
    </form>
  )
}
