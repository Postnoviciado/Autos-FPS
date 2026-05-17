import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle, Maintenance, Contact } from '@/types'
import { Loader2, ArrowLeft, Plus, X } from 'lucide-react'
import PhotoUploadField from '@/components/ui/PhotoUploadField'
import toast from 'react-hot-toast'

interface Props {
  vehicle: Vehicle
  maintenance?: Maintenance
  backPath: string
}

const parseServices = (s: unknown): string[] => {
  if (Array.isArray(s)) return s
  if (typeof s === 'string') { try { return JSON.parse(s) } catch { return [] } }
  return []
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateToISO(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`
}

function isoToLocal(dateStr?: string): string {
  if (!dateStr) return todayLocal()
  const d = new Date(dateStr.replace(' ', 'T'))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

export default function MaintenanceForm({ vehicle, maintenance, backPath }: Props) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showContactSuggestions, setShowContactSuggestions] = useState(false)
  const [showResponsableSuggestions, setShowResponsableSuggestions] = useState(false)
  const isEdit = !!maintenance

  // Photo files & previews
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

  // Initialize form with calculated next_mileage for regular maintenance
  const getInitialNextMileage = () => {
    if (maintenance?.next_mileage) return maintenance.next_mileage.toString()
    const currentMileage = maintenance?.current_mileage || vehicle.current_mileage
    return currentMileage ? (Number(currentMileage) + 5000).toString() : ''
  }

  const [form, setForm] = useState({
    type: maintenance?.type || 'regular' as 'regular' | 'additional',
    date: maintenance?.date ? isoToLocal(maintenance.date) : todayLocal(),
    performed_by: maintenance?.performed_by || '',
    location: maintenance?.location || '',
    current_mileage: maintenance?.current_mileage?.toString() || vehicle.current_mileage?.toString() || '',
    next_mileage: getInitialNextMileage(),
    notes: maintenance?.notes || '',
    services: parseServices(maintenance?.services),
  })
  const [newService, setNewService] = useState('')

  const set = (key: keyof typeof form, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  // Load contacts for autocomplete
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

  const handleMileageChange = (val: string) => {
    set('current_mileage', val)
    if (form.type === 'regular' && val)
      set('next_mileage', (Number(val) + 5000).toString())
  }

  const handleTypeChange = (t: 'regular' | 'additional') => {
    set('type', t)
    if (t === 'regular' && form.current_mileage) {
      set('next_mileage', (Number(form.current_mileage) + 5000).toString())
    } else if (t === 'additional') {
      set('next_mileage', '')
    }
  }

  const addService = () => {
    if (!newService.trim()) return
    set('services', [...form.services, newService.trim()])
    setNewService('')
  }

  const handleReceiptFile = (f: File | null) => {
    setReceiptFile(f)
    setReceiptPreview(f ? URL.createObjectURL(f) : undefined)
    setReceiptPreviewType(getPreviewType(f))
  }

  const handleDetailFile = (f: File | null) => {
    setDetailFile(f)
    setDetailPreview(f ? URL.createObjectURL(f) : undefined)
    setDetailPreviewType(getPreviewType(f))
  }

  // Contact autocomplete filtered lists
  const workshopContacts = contacts.filter(c =>
    c.type === 'workshop' || c.type === 'mechanic'
  )
  const filteredContacts = workshopContacts.filter(c =>
    c.name.toLowerCase().includes(form.location.toLowerCase()) && form.location.length > 0
  )

  const responsableContacts = contacts.filter(c =>
    c.type === 'responsable'
  )
  const filteredResponsables = responsableContacts.filter(c =>
    c.name.toLowerCase().includes(form.performed_by.toLowerCase()) && form.performed_by.length > 0
  )

  const syncVehicleMileageFromLatestRegularMaintenance = async () => {
    const { data: latestRegular, error: latestError } = await supabase
      .from('maintenance')
      .select('id, current_mileage, next_mileage')
      .eq('vehicle_id', vehicle.id)
      .eq('type', 'regular')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (latestError) throw latestError
    if (!latestRegular) return

    const { error: updateError } = await supabase.from('vehicles').update({
      current_mileage: latestRegular.current_mileage ?? null,
      next_mileage: latestRegular.next_mileage ?? null,
    }).eq('id', vehicle.id)
    if (updateError) throw updateError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let receiptPhotoPath: string | null = null
      let detailPhotoPath: string | null = null

      // Upload receipt photo if provided and is new
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop() || 'jpg'
        const fileName = `maintenance_receipt_${Date.now()}_${vehicle.id}.${ext}`
        const { data, error } = await supabase.storage.from('maintenance').upload(`${vehicle.id}/${fileName}`, receiptFile)
        if (error) throw error
        receiptPhotoPath = data?.path || null
      } else if (isEdit && !receiptFile && maintenance?.receipt_photo) {
        receiptPhotoPath = maintenance.receipt_photo
      }

      // Upload detail photo if provided and is new
      if (detailFile) {
        const ext = detailFile.name.split('.').pop() || 'jpg'
        const fileName = `maintenance_detail_${Date.now()}_${vehicle.id}.${ext}`
        const { data, error } = await supabase.storage.from('maintenance').upload(`${vehicle.id}/${fileName}`, detailFile)
        if (error) throw error
        detailPhotoPath = data?.path || null
      } else if (isEdit && !detailFile && maintenance?.detail_photo) {
        detailPhotoPath = maintenance.detail_photo
      }

      const data = {
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
      }

      if (isEdit) {
        const { error } = await supabase.from('maintenance').update(data).eq('id', maintenance.id)
        if (error) throw error
        await syncVehicleMileageFromLatestRegularMaintenance()
      } else {
        const { error: insertError } = await supabase.from('maintenance').insert(data)
        if (insertError) throw insertError
        if (form.type === 'regular' && form.current_mileage) {
          await syncVehicleMileageFromLatestRegularMaintenance()
        }
      }
      
      // Show success message and navigate
      toast.success(isEdit ? 'Mantenimiento actualizado' : 'Mantenimiento registrado')
      
      // Separate navigation from try-catch to avoid issues
      // Use setTimeout to ensure state updates are flushed
      setTimeout(() => {
        navigate(backPath)
      }, 300)
    } catch (err: unknown) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Error guardando mantenimiento:', err)
      toast.error(`Error: ${msg.slice(0, 80)}`)
    }
  }

  // Existing photo URLs when editing
  const receiptUrl = maintenance?.receipt_photo
    ? getFileUrl('maintenance', maintenance.receipt_photo)
    : undefined
  const detailUrl = maintenance?.detail_photo
    ? getFileUrl('maintenance', maintenance.detail_photo)
    : undefined

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(backPath)} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</h1>
          <p className="text-slate-400 text-sm">Vehículo: <span className="font-semibold text-slate-600">{vehicle.plate_number}</span></p>
        </div>
      </div>

      {/* Tipo */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Tipo de mantenimiento</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['regular', 'additional'] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${form.type === t ? 'border-brand-500 bg-brand-50' : 'border-cream-200 hover:border-cream-300'}`}>
              <p className={`font-semibold text-sm ${form.type === t ? 'text-brand-700' : 'text-slate-900'}`}>
                {t === 'regular' ? '🔄 Regular' : '⚡ Adicional'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t === 'regular' ? 'Mantenimiento periódico cada 5,000 km' : 'Reparación o servicio extra'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Información</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.date}
              onChange={e => set('date', e.target.value)} required />
          </div>
          <div className="relative">
            <label className="label">Llevado por</label>
            <input
              className="input"
              value={form.performed_by}
              onChange={e => { set('performed_by', e.target.value); setShowResponsableSuggestions(true) }}
              onFocus={() => setShowResponsableSuggestions(true)}
              onBlur={() => setTimeout(() => setShowResponsableSuggestions(false), 150)}
              placeholder="Nombre del hermano"
              autoComplete="off"
            />
            {/* Sugerencias de responsables */}
            {showResponsableSuggestions && (form.performed_by === '' ? responsableContacts : filteredResponsables).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-cream-50 border border-cream-200 rounded-xl shadow-lg overflow-hidden">
                <p className="text-xs text-slate-600 px-3 py-2 border-b border-cream-100">Responsables guardados</p>
                {(form.performed_by === '' ? responsableContacts : filteredResponsables).slice(0, 6).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-cream-100 text-left transition-colors"
                    onMouseDown={() => { set('performed_by', c.name); setShowResponsableSuggestions(false) }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone ? `${c.phone}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Taller con autocompletado de contactos */}
          <div className="relative sm:col-span-2">
            <label className="label">Taller / Mecánico</label>
            <input
              className="input"
              value={form.location}
              onChange={e => { set('location', e.target.value); setShowContactSuggestions(true) }}
              onFocus={() => setShowContactSuggestions(true)}
              onBlur={() => setTimeout(() => setShowContactSuggestions(false), 150)}
              placeholder="Nombre del taller o mecánico"
              autoComplete="off"
            />
            {/* Sugerencias */}
            {showContactSuggestions && (form.location === '' ? workshopContacts : filteredContacts).length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-cream-50 border border-cream-200 rounded-xl shadow-lg overflow-hidden">
                <p className="text-xs text-slate-600 px-3 py-2 border-b border-cream-100">Contactos guardados</p>
                {(form.location === '' ? workshopContacts : filteredContacts).slice(0, 6).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-cream-100 text-left transition-colors"
                    onMouseDown={() => { set('location', c.name); setShowContactSuggestions(false) }}
                  >
                    <div className="flex-1 min-w-0">
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
                <label className="label">Kilometraje actual</label>
                <input type="number" className="input" value={form.current_mileage}
                  onChange={e => handleMileageChange(e.target.value)} placeholder="km" min={0} />
              </div>
              <div>
                <label className="label">Próximo mantenimiento (km)</label>
                <input type="number" className="input bg-cream-100 text-slate-700"
                  value={form.next_mileage} readOnly placeholder="Ingresa el kilometraje actual" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Servicios */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Servicios realizados</h2>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={newService}
            onChange={e => setNewService(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService() } }}
            placeholder="Ej: Cambio de aceite, filtro de aire..." />
          <button type="button" onClick={addService} className="btn-secondary px-3"><Plus size={16} /></button>
        </div>
        {form.services.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.services.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-sm">
                {s}
                <button type="button" onClick={() => set('services', form.services.filter((_, idx) => idx !== i))}
                  className="hover:text-red-500 transition-colors"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Fotos */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Documentos fotográficos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <PhotoUploadField
            label="Boleta de pago"
            currentUrl={receiptUrl}
            previewUrl={receiptPreview}
            previewType={receiptPreviewType}
            onFileSelected={handleReceiptFile}
          />
          <PhotoUploadField
            label="Detalle del mantenimiento"
            currentUrl={detailUrl}
            previewUrl={detailPreview}
            previewType={detailPreviewType}
            onFileSelected={handleDetailFile}
          />
        </div>
      </div>

      {/* Notas */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Notas adicionales</h2>
        <textarea className="input resize-none" rows={3} value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Observaciones, piezas cambiadas, recomendaciones del técnico..." />
      </div>

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => navigate(backPath)} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading && <Loader2 size={15} className="animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Registrar mantenimiento'}
        </button>
      </div>
    </form>
  )
}
