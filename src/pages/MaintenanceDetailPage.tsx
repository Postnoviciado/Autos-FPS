import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import type { Vehicle, Maintenance } from '@/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Edit, Trash2, Wrench, Calendar, User, MapPin, Gauge, FileText, Loader2, Image, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function MaintenanceDetailPage() {
  const { id, maintenanceId } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!id || !maintenanceId) return
    Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single(),
      supabase.from('maintenance').select('*').eq('id', maintenanceId).single(),
    ]).then(([vRes, mRes]) => {
      if (vRes.error) throw vRes.error
      if (mRes.error) throw mRes.error
      setVehicle(vRes.data)
      setMaintenance(mRes.data)
    })
      .catch((err) => {
        console.error(err)
        navigate(`/mantenimiento/${id}`)
      })
      .finally(() => setLoading(false))
  }, [id, maintenanceId])

  const handleDelete = async () => {
    if (!maintenance) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('maintenance').delete().eq('id', maintenance.id)
      if (error) throw error
      toast.success('Eliminado')
      navigate(`/mantenimiento/${id}`)
    } catch { toast.error('Error') } finally { setDeleting(false) }
  }

  const services: string[] = Array.isArray(maintenance?.services)
    ? maintenance!.services
    : (typeof maintenance?.services === 'string'
      ? (() => { try { return JSON.parse(maintenance.services) } catch { return [] } })()
      : [])
  const dateStr = maintenance?.date ? maintenance.date.replace(' ', 'T') : null

  const receiptUrl = maintenance?.receipt_photo ? getFileUrl('maintenance', maintenance.receipt_photo) : null
  const detailUrl = maintenance?.detail_photo ? getFileUrl('maintenance', maintenance.detail_photo) : null
  const receiptIsPdf = receiptUrl?.toLowerCase().endsWith('.pdf') ?? false
  const detailIsPdf = detailUrl?.toLowerCase().endsWith('.pdf') ?? false

  useEffect(() => {
    if (!location.hash) return
    const elementId = location.hash.replace('#', '')
    const el = document.getElementById(elementId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, receiptUrl, detailUrl])

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
  if (!vehicle || !maintenance) return null

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/mantenimiento/${id}`)} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Detalle de mantenimiento</h1>
            <p className="text-slate-400 text-sm">{vehicle.plate_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/mantenimiento/${id}/${maintenanceId}/editar`)} className="btn-secondary">
            <Edit size={15} /> Editar
          </button>
          <button onClick={() => setDeleteOpen(true)} className="btn-ghost text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className={clsx('inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-medium text-sm',
        maintenance.type === 'regular' ? 'bg-brand-50 text-brand-700 border-brand-100' : 'bg-amber-50 text-amber-700 border-amber-100')}>
        <Wrench size={15} />
        Mantenimiento {maintenance.type === 'regular' ? 'Regular' : 'Adicional'}
      </div>

      <div className="card divide-y divide-slate-100">
        {[
          { icon: Calendar, label: 'Fecha', value: dateStr ? format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: es }) : 'No especificada' },
          { icon: User, label: 'Llevado por', value: maintenance.performed_by || 'No especificado' },
          { icon: MapPin, label: 'Taller / Mecánico', value: maintenance.location || 'No especificado' },
          { icon: Gauge, label: 'Kilometraje al momento', value: maintenance.current_mileage ? `${maintenance.current_mileage.toLocaleString()} km` : 'No registrado' },
          { icon: Gauge, label: 'Próximo mantenimiento', value: maintenance.next_mileage ? `${maintenance.next_mileage.toLocaleString()} km` : 'No especificado' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 px-5 py-4">
            <Icon size={16} className="text-slate-400 flex-shrink-0" />
            <div><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>
          </div>
        ))}
      </div>

      {services.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-3">Servicios realizados</h2>
          <div className="flex flex-wrap gap-2">
            {services.map((s, i) => <span key={i} className="px-3 py-1.5 rounded-full bg-cream-100 text-slate-800 text-sm border border-cream-200">{s}</span>)}
          </div>
        </div>
      )}

      {/* Fotos con zoom */}
      {(receiptUrl || detailUrl) && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Image size={16} className="text-slate-400" />
            <h2 className="section-title">Documentos fotográficos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {receiptUrl && (
              <div id="receipt">
                <p className="text-xs text-slate-400 mb-2">Boleta de pago</p>
                <div className="rounded-xl overflow-hidden border border-cream-200 h-72">
                  {receiptIsPdf ? (
                    <iframe src={receiptUrl} title="Boleta de pago" className="w-full h-full" />
                  ) : (
                    <ImageZoomViewer src={receiptUrl} alt="Boleta de pago" />
                  )}
                </div>
              </div>
            )}
            {detailUrl && (
              <div id="detail">
                <p className="text-xs text-slate-400 mb-2">Detalle del mantenimiento</p>
                <div className="rounded-xl overflow-hidden border border-cream-200 h-72">
                  {detailIsPdf ? (
                    <iframe src={detailUrl} title="Detalle del mantenimiento" className="w-full h-full" />
                  ) : (
                    <ImageZoomViewer src={detailUrl} alt="Detalle del mantenimiento" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {maintenance.notes && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-slate-400" />
            <h2 className="section-title">Notas</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{maintenance.notes}</p>
        </div>
      )}

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        loading={deleting} title="¿Eliminar mantenimiento?" message="Esta acción no se puede deshacer." confirmLabel="Sí, eliminar" />
    </div>
  )
}

function ImageZoomViewer({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    setScale(1)
    setRotation(0)
  }, [src])

  const updateScale = (nextScale: number) => setScale(Math.min(5, Math.max(0.5, nextScale)))

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.1 : -0.1
    const container = containerRef.current
    if (!container) {
      updateScale(scale + delta)
      return
    }

    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const nextScale = Math.min(5, Math.max(0.5, scale + delta))
    const ratio = nextScale / scale

    container.scrollLeft = (container.scrollLeft + pointerX) * ratio - pointerX
    container.scrollTop = (container.scrollTop + pointerY) * ratio - pointerY
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
    <div className="relative w-full h-full bg-black/5 overflow-hidden">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button type="button" onClick={() => updateScale(Math.max(0.5, scale - 0.5))} className="btn-ghost p-2 rounded-lg">
          <ZoomOut size={16} />
        </button>
        <button type="button" onClick={() => updateScale(1)} className="btn-ghost p-2 rounded-lg">
          {Math.round(scale * 100)}%
        </button>
        <button type="button" onClick={() => updateScale(Math.min(5, scale + 0.5))} className="btn-ghost p-2 rounded-lg">
          <ZoomIn size={16} />
        </button>
        <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} className="btn-ghost p-2 rounded-lg">
          <RotateCw size={16} />
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full h-full overflow-auto touch-pan-y"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          className="block mx-auto"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease',
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}
