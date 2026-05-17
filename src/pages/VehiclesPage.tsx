import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle } from '@/types'
import { formatDate, getDateStatus, getMileageStatus } from '@/lib/dateUtils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { Car, Plus, Search, Camera, FileText, Info, Trash2, Edit, Loader2, X, Save, Upload, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type Tab = 'foto' | 'datos' | 'tarjeta'

export default function VehiclesPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [tab, setTab] = useState<Tab>('foto')

  const load = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', user.id).order('plate_number', { ascending: true })
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.warn('Failed to load vehicles:', err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user])

  const filtered = vehicles.filter(v => v.plate_number.toLowerCase().includes(search.toLowerCase()))

  const openModal = (v: Vehicle, t: Tab = 'foto') => { setSelected(v); setTab(t) }
  const closeModal = () => { setSelected(null); load() }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Vehículos</h1>
          <p className="text-slate-400 text-sm mt-0.5">{vehicles.length} registrado{vehicles.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/vehiculos/agregar')} className="btn-primary">
          <Plus size={16} /> Agregar vehículo
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 text-sm" placeholder="Buscar por placa..." />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Car} title={search ? 'Sin resultados' : 'No hay vehículos'} description={search ? `No se encontró "${search}"` : 'Agrega tu primer vehículo.'}
          action={!search ? <button onClick={() => navigate('/vehiculos/agregar')} className="btn-primary"><Plus size={15} /> Agregar</button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <VehicleCard key={v.id} vehicle={v} onOpenTab={openModal} />
          ))}
        </div>
      )}

      {selected && (
        <Modal open={!!selected} onClose={closeModal} title={`Vehículo ${selected.plate_number}`} size="lg">
          <VehicleModalTabs vehicle={selected} tab={tab} setTab={setTab} onClose={closeModal} onDeleted={() => { closeModal(); navigate('/vehiculos') }} />
        </Modal>
      )}
    </div>
  )
}

/* ── Tarjeta resumen ── */
function VehicleCard({ vehicle: v, onOpenTab }: { vehicle: Vehicle; onOpenTab: (v: Vehicle, t: Tab) => void }) {
  const navigate = useNavigate()
  const photoUrl = v.photo ? getFileUrl('vehicles', v.photo) : null

  return (
    <div className="card border border-brand-200 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[44%_56%] gap-3 p-3 items-stretch">
        <div className="space-y-2.5">
          <div>
            <h3 className="font-display font-bold text-xl tracking-wide text-slate-900">{v.plate_number}</h3>
            {(v.brand || v.model) && (
              <p className="text-xs text-slate-400 mt-2">{`${v.brand || ''}: ${v.model || ''}`}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">Año {v.manufacture_year}</p>
          </div>

          <div className="grid gap-1.5 max-w-[220px]">
            <button onClick={() => onOpenTab(v, 'datos')} className="btn-secondary px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-cream-200 flex items-center justify-start gap-2 text-left">
              <Info size={18} />
              <span>Datos</span>
            </button>
            <div className="btn-secondary group px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-cream-200 flex items-center justify-between gap-2 rounded-md">
              <button
                type="button"
                onClick={() => {
                  const propertyCardUrl = v.property_card ? getFileUrl('vehicles', v.property_card) : null
                  if (propertyCardUrl) {
                    navigate(`/vehiculos/${v.id}/tarjeta`)
                  } else {
                    onOpenTab(v, 'tarjeta')
                  }
                }}
                className="flex-1 flex items-center gap-2 text-left text-slate-900"
              >
                <FileText size={18} />
                <span>Tarjeta</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenTab(v, 'tarjeta')}
                className="p-1 rounded-md text-slate-700 hover:bg-cream-200"
                aria-label="Editar tarjeta"
              >
                <Edit size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-full rounded-3xl bg-cream-100 p-2">
          <button onClick={() => onOpenTab(v, 'foto')} className="w-full h-full rounded-3xl overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
          {photoUrl ? (
            <img src={photoUrl} alt={v.plate_number} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
              <Camera size={32} />
              <span className="text-xs">Agregar foto</span>
            </div>
          )}
        </button>
      </div>
    </div>
  </div>
  )
}

/* ── Modal con pestañas ── */
function VehicleModalTabs({ vehicle, tab, setTab, onClose, onDeleted }: {
  vehicle: Vehicle; tab: Tab; setTab: (t: Tab) => void; onClose: () => void; onDeleted: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id)
      if (error) throw error
      toast.success('Vehículo eliminado')
      onDeleted()
    } catch { toast.error('Error al eliminar') } finally { setDeleting(false) }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-cream-100 px-6 gap-1">
        {([['foto', 'Foto', Camera], ['datos', 'Datos', Info], ['tarjeta', 'Tarjeta propiedad', FileText]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={clsx('flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors', tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pb-1">
          <button onClick={() => setDeleteOpen(true)} className="btn-ghost text-red-500 hover:bg-red-50 text-xs py-1 px-2">
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6">
        {tab === 'foto' && <ImageTab vehicle={vehicle} field="photo" label="Foto del vehículo" onSaved={onClose} />}
        {tab === 'datos' && <DatosTab vehicle={vehicle} onSaved={onClose} />}
        {tab === 'tarjeta' && <ImageTab vehicle={vehicle} field="property_card" label="Tarjeta de propiedad" onSaved={onClose} />}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="¿Eliminar vehículo?"
        message={`Está a punto de eliminar ${vehicle.plate_number} con todo su historial de mantenimiento.`}
        confirmLabel="Sí, eliminar vehículo"
        doubleConfirm={true}
        doubleConfirmText="ELIMINAR"
      />
    </div>
  )
}

/* ── Pestaña de imagen (foto o tarjeta) ── */
function ImageTab({ vehicle, field, label, onSaved }: { vehicle: Vehicle; field: 'photo' | 'property_card'; label: string; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'image' | 'pdf'>('image')
  const [file, setFile] = useState<File | null>(null)

  const currentUrl = vehicle[field]
    ? getFileUrl('vehicles', vehicle[field] as string)
    : null
  const currentType = vehicle[field]?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setPreviewType(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
  }

  const fileLabel = field === 'property_card' ? 'archivo' : 'imagen'

  const handleSave = async () => {
    if (!file) return
    setSaving(true)
    try {
      const timestamp = Date.now()
      const ext = file.name.split('.').pop()
      const fileName = `${timestamp}.${ext}`
      const filePath = `${vehicle.id}/${fileName}`
      
      const { error: uploadError } = await supabase.storage.from('vehicles').upload(filePath, file)
      if (uploadError) throw uploadError
      
      const { error: updateError } = await supabase.from('vehicles').update({ [field]: filePath }).eq('id', vehicle.id)
      if (updateError) throw updateError
      
      toast.success(`${fileLabel.charAt(0).toUpperCase() + fileLabel.slice(1)} guardado`)
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('Photo save error:', err)
      toast.error(`Error: ${msg.slice(0, 80)}`)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('vehicles').update({ [field]: null }).eq('id', vehicle.id)
      if (error) throw error
      toast.success(`${fileLabel.charAt(0).toUpperCase() + fileLabel.slice(1)} eliminad${fileLabel === 'imagen' ? 'a' : 'o'}`)
      onSaved()
    } catch { toast.error('Error al eliminar') } finally { setSaving(false) }
  }

  const displayUrl = preview || currentUrl
  const displayType = preview ? previewType : currentType

  return (
    <div className="space-y-4">
      <h3 className="section-title">{label}</h3>

      {/* Vista previa */}
      <div className="w-full h-56 rounded-xl border-2 border-dashed border-cream-200 overflow-hidden bg-cream-100 flex items-center justify-center">
        {displayUrl ? (
          displayType === 'pdf' ? (
            <iframe src={displayUrl} title={label} className="w-full h-full" />
          ) : (
            <ImageZoomInline src={displayUrl} alt={label} />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <ImageIcon size={40} />
            <span className="text-sm">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Acciones — exactamente como v3 pero con type="button" */}
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleSelect} />

        <button type="button" onClick={() => {
          if (fileRef.current) {
            fileRef.current.removeAttribute('capture')
            fileRef.current.click()
          }
        }} className="btn-secondary">
          <Upload size={14} /> Seleccionar archivo
        </button>
        <button type="button" onClick={() => {
          if (fileRef.current) {
            fileRef.current.setAttribute('capture', 'environment')
            fileRef.current.click()
          }
        }} className="btn-secondary">
          <Camera size={14} /> Tomar foto
        </button>

        {file && (
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        )}
        {file && (
          <button type="button" onClick={() => { setFile(null); setPreview(null) }} className="btn-ghost text-slate-500">
            <X size={14} /> Cancelar
          </button>
        )}
        {currentUrl && !file && (
          <button type="button" onClick={handleDelete} disabled={saving} className="btn-ghost text-red-500 hover:bg-red-50">
            <Trash2 size={14} /> Eliminar {fileLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function ImageZoomInline({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    setScale(1)
    setRotation(0)
  }, [src])

  const updateScale = (nextScale: number) => {
    setScale(Math.min(5, Math.max(0.5, nextScale)))
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const container = containerRef.current
    const delta = event.deltaY < 0 ? 0.1 : -0.1
    const nextScale = Math.min(5, Math.max(0.5, scale + delta))

    if (container && scale !== 0) {
      const rect = container.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const ratio = nextScale / scale

      container.scrollLeft = (container.scrollLeft + pointerX) * ratio - pointerX
      container.scrollTop = (container.scrollTop + pointerY) * ratio - pointerY
    }

    updateScale(nextScale)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    setIsDragging(true)
    container.setPointerCapture(event.pointerId)
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const container = containerRef.current
    if (!container) return

    event.preventDefault()
    const dx = event.clientX - dragStart.current.x
    const dy = event.clientY - dragStart.current.y
    container.scrollLeft = dragStart.current.scrollLeft - dx
    container.scrollTop = dragStart.current.scrollTop - dy
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    setIsDragging(false)
    container.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="w-full h-full min-h-[240px] rounded-xl bg-cream-100 overflow-auto p-2" ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <img
        src={src}
        alt={alt}
        className="block select-none"
        style={{
          width: `${scale * 100}%`,
          maxWidth: 'none',
          height: 'auto',
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.2s ease',
          transformOrigin: 'center center',
          userSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}

function DatosTab({ vehicle, onSaved }: { vehicle: Vehicle; onSaved: () => void }) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [vals, setVals] = useState({
    plate_number: vehicle.plate_number,
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    manufacture_year: vehicle.manufacture_year?.toString() || '',
    soat_expiry: vehicle.soat_expiry ? vehicle.soat_expiry.slice(0, 10) : '',
    tech_review_last: vehicle.tech_review_last ? vehicle.tech_review_last.slice(0, 10) : '',
    extinguisher_renewal: vehicle.extinguisher_renewal ? vehicle.extinguisher_renewal.slice(0, 10) : '',
    air_pressure: vehicle.air_pressure?.toString() || '',
    current_mileage: vehicle.current_mileage?.toString() || '',
    next_mileage: vehicle.next_mileage?.toString() || '',
    mileage_alert_km: vehicle.mileage_alert_km?.toString() || '500',
  })
  const [saving, setSaving] = useState(false)

  const saveField = async (field: string) => {
    setSaving(true)
    try {
      const v = vals[field as keyof typeof vals]
      const dateFields = ['soat_expiry', 'tech_review_last', 'extinguisher_renewal']
      const textFields = ['plate_number', 'brand', 'model']
      const payload: Record<string, unknown> = {}
      if (field === 'plate_number') payload[field] = (v as string).toUpperCase()
      else if (textFields.includes(field)) payload[field] = (v as string) || null
      else if (dateFields.includes(field)) payload[field] = v || null
      else payload[field] = v ? Number(v) : null
      const { error } = await supabase.from('vehicles').update(payload).eq('id', vehicle.id)
      if (error) throw error
      toast.success('Guardado')
      setEditingField(null)
      onSaved()
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }

  const soatStatus = getDateStatus(vehicle.soat_expiry)
  const extinStatus = getDateStatus(vehicle.extinguisher_renewal)
  const kmStatus = getMileageStatus(vehicle.current_mileage, vehicle.next_mileage)

  const fields = [
    { key: 'plate_number', label: 'Placa', type: 'text', display: vehicle.plate_number, status: null },
    { key: 'brand', label: 'Marca', type: 'text', display: vehicle.brand || 'No registrado', status: null },
    { key: 'model', label: 'Modelo', type: 'text', display: vehicle.model || 'No registrado', status: null },
    { key: 'manufacture_year', label: 'Año de fabricación', type: 'number', display: vehicle.manufacture_year?.toString(), status: null },
    { key: 'soat_expiry', label: 'Vencimiento SOAT', type: 'date', display: formatDate(vehicle.soat_expiry), status: soatStatus },
    { key: 'tech_review_last', label: 'Última Rev. Técnica', type: 'date', display: formatDate(vehicle.tech_review_last), status: null },
    { key: 'extinguisher_renewal', label: 'Renovación Extintor', type: 'date', display: formatDate(vehicle.extinguisher_renewal), status: extinStatus },
    { key: 'current_mileage', label: 'Kilometraje actual', type: 'number', display: vehicle.current_mileage ? `${vehicle.current_mileage.toLocaleString()} km` : 'No registrado', status: null },
    { key: 'next_mileage', label: 'Próximo mantenimiento (km)', type: 'number', display: vehicle.next_mileage ? `${vehicle.next_mileage.toLocaleString()} km` : 'No registrado', status: kmStatus },
    { key: 'air_pressure', label: 'Presión neumáticos (PSI)', type: 'number', display: vehicle.air_pressure ? `${vehicle.air_pressure} PSI` : 'No registrado', status: null },
    { key: 'mileage_alert_km', label: 'Avisar cuando falten (km)', type: 'number', display: vehicle.mileage_alert_km ? `${vehicle.mileage_alert_km} km` : '500 km', status: null },
  ]

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
        <Edit size={10} /> Haz clic en cualquier campo para editarlo
      </p>
      {fields.map(({ key, label, type, display, status }) => {
        const isEditing = editingField === key
        return (
          <div key={key}
            className={clsx('flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer',
              isEditing ? 'border-brand-300 bg-brand-50' : 'border-cream-200 bg-cream-100 hover:border-cream-300 hover:bg-cream-200'
            )}
            onClick={() => { if (!isEditing) setEditingField(key) }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              {isEditing ? (
                <input
                  type={type as 'text' | 'number' | 'date'}
                  value={vals[key as keyof typeof vals]}
                  onChange={e => setVals(f => ({ ...f, [key]: e.target.value }))}
                  className="input py-1 text-sm"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{display}</span>
                  {status && <StatusBadge status={status} />}
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => saveField(key)} disabled={saving} className="btn-primary py-1 px-2 text-xs">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                </button>
                <button onClick={() => setEditingField(null)} className="btn-secondary py-1 px-2 text-xs">
                  <X size={12} /> Cancelar
                </button>
              </div>
            ) : (
              <Edit size={12} className="text-slate-300 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
