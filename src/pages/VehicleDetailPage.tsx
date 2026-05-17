import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import type { Vehicle, Maintenance } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import ImageZoomViewer from '@/components/ui/ImageZoomViewer'
import { ArrowLeft, Plus, Wrench, Loader2, Calendar, User, MapPin, Gauge, Edit, Trash2, FileText, Image, Upload, Save } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function VehicleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileModalOpen, setFileModalOpen] = useState(false)
  const [fileModalType, setFileModalType] = useState<'boleta' | 'detalle'>('boleta')
  const [fileModalMode, setFileModalMode] = useState<'view' | 'edit'>('view')
  const [fileModalMaintenance, setFileModalMaintenance] = useState<Maintenance | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    if (!id) {
      setError('ID de vehículo no válido.')
      setLoading(false)
      return
    }

    try {
      const [vRes, mRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', id).single(),
        supabase.from('maintenance').select('*').eq('vehicle_id', id).order('date', { ascending: false }),
      ])
      
      if (vRes.error) throw vRes.error
      if (mRes.error) throw mRes.error
      
      setVehicle(vRes.data)
      setMaintenances(mRes.data || [])
    } catch (err) {
      console.error('Failed to load vehicle details for id:', id, err)
      const message = err instanceof Error ? err.message : String(err)
      setError(`No se pudo cargar los datos del vehículo (id=${id}). ${message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const openFileModal = (maintenance: Maintenance, type: 'boleta' | 'detalle', mode: 'view' | 'edit' = 'view') => {
    setFileModalOpen(true)
    setFileModalType(type)
    setFileModalMode(mode)
    setFileModalMaintenance(maintenance)
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const closeFileModal = () => {
    setFileModalOpen(false)
    setFileModalMaintenance(null)
    setFileModalMode('view')
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const updateMaintenanceRecord = (maintenanceId: string, updatePayload: Partial<Maintenance>) => {
    setMaintenances(prev => prev.map(item => item.id === maintenanceId ? { ...item, ...updatePayload } : item))
    setFileModalMaintenance(prev => prev ? { ...prev, ...updatePayload } : prev)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
    }
    event.target.value = ''
  }

  const handleSaveFile = async () => {
    if (!id || !fileModalMaintenance || !selectedFile || !fileModalType) return
    setUploadingFile(true)
    try {
      const ext = selectedFile.name.split('.').pop() ?? 'jpg'
      const fileName = `${fileModalType}-${Date.now()}.${ext}`
      const filePath = `${id}/${fileModalMaintenance.id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('maintenance').upload(filePath, selectedFile, { upsert: true })
      if (uploadError) throw uploadError

      const updatePayload = fileModalType === 'boleta'
        ? { receipt_photo: filePath }
        : { detail_photo: filePath }

      const { error: updateError } = await supabase.from('maintenance').update(updatePayload).eq('id', fileModalMaintenance.id)
      if (updateError) throw updateError

      updateMaintenanceRecord(fileModalMaintenance.id, updatePayload)
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setFileModalMode('view')
      toast.success('Archivo actualizado')
    } catch (err) {
      console.error(err)
      toast.error('Error al actualizar el archivo')
    } finally {
      setUploadingFile(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-slate-300" />
    </div>
  )

  if (error) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Error al cargar"
        description={error}
        action={
          <button type="button" onClick={() => navigate('/mantenimiento')} className="btn-primary">
            Volver a mantenimiento
          </button>
        }
      />
    )
  }

  if (!vehicle) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Vehículo no encontrado"
        description={`No se encontró el vehículo con ID: ${id}`}
        action={
          <button type="button" onClick={() => navigate('/mantenimiento')} className="btn-primary">
            Volver a mantenimiento
          </button>
        }
      />
    )
  }

  const currentFileKey = fileModalMaintenance
    ? fileModalType === 'boleta'
      ? fileModalMaintenance.receipt_photo
      : fileModalMaintenance.detail_photo
    : null
  const currentFileUrl = currentFileKey ? getFileUrl('maintenance', currentFileKey) : null
  const displayUrl = selectedFile && previewUrl ? previewUrl : currentFileUrl
  const isPdf = selectedFile
    ? selectedFile.type === 'application/pdf'
    : (displayUrl?.toLowerCase().endsWith('.pdf') ?? false)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/mantenimiento')}
            className="btn-ghost p-2"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title tracking-widest">{vehicle.plate_number}</h1>
            <p className="text-slate-400 text-sm">
              Historial de mantenimiento · {maintenances.length} registro{maintenances.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="grid w-full gap-3 grid-cols-1 xl:w-auto">
          <button
            type="button"
            onClick={() => navigate(`/mantenimiento/${id}/agregar`)}
            className="btn-primary w-full xl:w-auto"
          >
            <Plus size={15} /> Agregar mantenimiento
          </button>
        </div>
      </div>

      {/* Lista de mantenimientos */}
      {maintenances.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Sin mantenimientos"
          description="Registra el primer mantenimiento de este vehículo."
          action={
            <button
              type="button"
              onClick={() => navigate(`/mantenimiento/${id}/agregar`)}
              className="btn-primary"
            >
              <Plus size={15} /> Agregar mantenimiento
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {maintenances.map(m => (
            <MaintCard
              key={m.id}
              m={m}
              vehicleId={id!}
              onDeleted={load}
              onOpenFileModal={openFileModal}
            />
          ))}
        </div>
      )}

      <Modal open={fileModalOpen} onClose={closeFileModal} title={`${fileModalType === 'boleta' ? 'Boleta' : 'Detalles'}${fileModalMode === 'edit' ? ' · Editar' : ''}`} size="xl">
        <div className="space-y-4 px-4 pb-6 pt-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFileModalType('boleta')}
              className={clsx(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                fileModalType === 'boleta'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              Boleta
            </button>
            <button
              type="button"
              onClick={() => setFileModalType('detalle')}
              className={clsx(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                fileModalType === 'detalle'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              Detalles
            </button>
            {fileModalMode === 'edit' && (
              <span className="ml-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                Modo edición
              </span>
            )}
          </div>

          <div className="rounded-3xl border border-cream-200 overflow-hidden bg-cream-50 min-h-[50vh]">
            {displayUrl ? (
              isPdf ? (
                <iframe src={displayUrl} title={`${fileModalType} preview`} className="w-full h-[70vh] min-h-[400px] border-none" />
              ) : (
                <ImageZoomViewer src={displayUrl} alt={`${fileModalType} preview`} />
              )
            ) : (
              <div className="flex h-[35vh] flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
                <FileText size={36} />
                <p className="text-sm font-medium">No hay archivo cargado</p>
                <p className="text-sm text-slate-400">Selecciona un archivo para ver o reemplazar el contenido.</p>
              </div>
            )}
          </div>

          {fileModalMode === 'edit' && (
            <div className="space-y-4 rounded-3xl border border-cream-200 bg-cream-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <Upload size={14} /> Seleccionar archivo
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || uploadingFile}
                  onClick={handleSaveFile}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Save size={14} /> Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl)
                      setPreviewUrl(null)
                    }
                  }}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <p className="text-sm text-slate-500">Archivo listo para subir: {selectedFile.name}</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

/* ── Tarjeta de mantenimiento ── */

function MaintCard({ m, vehicleId, onDeleted, onOpenFileModal }: {
  m: Maintenance
  vehicleId: string
  onDeleted: () => void
  onOpenFileModal: (maintenance: Maintenance, type: 'boleta' | 'detalle', mode: 'view' | 'edit') => void
}) {
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const services: string[] = Array.isArray(m.services)
    ? m.services
    : (() => { try { return JSON.parse(m.services as unknown as string || '[]') } catch { return [] } })()

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('maintenance').delete().eq('id', m.id)
      if (error) throw error
      toast.success('Mantenimiento eliminado')
      onDeleted()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const dateStr = m.date ? m.date.replace(' ', 'T') : null
  const receiptUrl = m.receipt_photo ? getFileUrl('maintenance', m.receipt_photo) : null
  const detailUrl = m.detail_photo ? getFileUrl('maintenance', m.detail_photo) : null

  return (
    <>
      <div className={clsx(
        'card overflow-hidden hover:shadow-md transition-all',
        m.type === 'regular' ? 'border-l-4 border-l-brand-400' : 'border-l-4 border-l-amber-400'
      )}>
        <div className="p-4 flex items-start gap-3">
          {/* Ícono */}
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
            m.type === 'regular' ? 'bg-brand-50' : 'bg-amber-50'
          )}>
            <Wrench size={18} className={m.type === 'regular' ? 'text-brand-600' : 'text-amber-600'} />
          </div>

          {/* Contenido — clic para ver detalle */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => navigate(`/mantenimiento/${vehicleId}/${m.id}`)}
          >
            {/* Tipo + fecha */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={clsx(
                'badge text-xs font-semibold',
                m.type === 'regular'
                  ? 'bg-brand-50 text-brand-700 border border-brand-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              )}>
                {m.type === 'regular' ? 'Regular' : 'Adicional'}
              </span>
              {dateStr && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar size={11} />
                  {format(parseISO(dateStr), "dd 'de' MMMM yyyy", { locale: es })}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-1.5">
              {m.performed_by && (
                <span className="flex items-center gap-1"><User size={11} />{m.performed_by}</span>
              )}
              {m.location && (
                <span className="flex items-center gap-1"><MapPin size={11} />{m.location}</span>
              )}
              {m.current_mileage && (
                <span className="flex items-center gap-1"><Gauge size={11} />{m.current_mileage.toLocaleString()} km</span>
              )}
            </div>

            {/* Servicios */}
            {services.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {services.slice(0, 4).map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-cream-100 text-slate-700 text-xs">{s}</span>
                ))}
                {services.length > 4 && (
                  <span className="px-2 py-0.5 rounded-full bg-cream-100 text-slate-700 text-xs">
                    +{services.length - 4} más
                  </span>
                )}
              </div>
            )}

            {/* Botones de boleta y detalles */}
            <div className="flex flex-wrap gap-2 mb-2">
              {receiptUrl && (
                <div className="inline-flex rounded-full border border-cream-200 bg-cream-50 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/boleta`)
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-cream-100 transition-colors"
                  >
                    <Image size={14} /> Boleta
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      onOpenFileModal(m, 'boleta', 'edit')
                    }}
                    className="inline-flex items-center justify-center px-3 text-slate-700 bg-slate-50 hover:bg-cream-100 transition-colors"
                    title="Editar boleta"
                  >
                    <Edit size={14} />
                  </button>
                </div>
              )}
              {detailUrl && (
                <div className="inline-flex rounded-full border border-cream-200 bg-cream-50 overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/detalle`)
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-cream-100 transition-colors"
                  >
                    <FileText size={14} /> Detalles
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      onOpenFileModal(m, 'detalle', 'edit')
                    }}
                    className="inline-flex items-center justify-center px-3 text-slate-700 bg-slate-50 hover:bg-cream-100 transition-colors"
                    title="Editar detalle"
                  >
                    <Edit size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Notas */}
            {m.notes && (
              <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                <FileText size={10} className="mt-0.5 flex-shrink-0" />
                <span className="truncate">{m.notes}</span>
              </p>
            )}
          </div>

          {/* Botones — columna separada, sin onClick en el padre */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/mantenimiento/${vehicleId}/${m.id}/editar`)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors border border-transparent hover:border-brand-100"
              title="Editar"
            >
              <Edit size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100"
              title="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="¿Eliminar mantenimiento?"
        message="Se eliminará este registro permanentemente. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
      />
    </>
  )
}
