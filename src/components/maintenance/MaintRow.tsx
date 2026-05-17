import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import type { Maintenance } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import ZoomImage from '@/components/ui/ZoomImage'
import { Wrench, Calendar, User, MapPin, Gauge, Edit, Trash2, FileText, Image, Upload, Save } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  m: Maintenance
  vehicleId: string
  basePath: string   // e.g. "/mantenimiento" or "/mantenimiento"
  onDeleted: () => void
}

export default function MaintRow({ m, vehicleId, basePath, onDeleted }: Props) {
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [receiptPhoto, setReceiptPhoto] = useState(m.receipt_photo || null)
  const [detailPhoto, setDetailPhoto] = useState(m.detail_photo || null)
  const [previewType, setPreviewType] = useState<'receipt' | 'detail' | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const services: string[] = Array.isArray(m.services)
    ? m.services
    : (typeof m.services === 'string'
      ? (() => { try { return JSON.parse(m.services) } catch { return [] } })()
      : [])

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

  const currentUrl = previewType === 'receipt'
    ? receiptPhoto ? getFileUrl('maintenance', receiptPhoto) : null
    : detailPhoto ? getFileUrl('maintenance', detailPhoto) : null
  const currentIsPdf = currentUrl ? /\.pdf($|\?)/i.test(currentUrl) : false
  const currentLabel = previewType === 'receipt' ? 'Boleta de pago' : 'Detalle del mantenimiento'

  const closePreview = () => {
    setPreviewType(null)
    setSelectedFile(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleUploadImage = async () => {
    if (!previewType || !selectedFile) return
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop() ?? 'jpg'
      const fileName = `${Date.now()}.${ext}`
      const filePath = `${vehicleId}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('maintenance').upload(filePath, selectedFile)
      if (uploadError) throw uploadError

      const updatePayload = previewType === 'receipt'
        ? { receipt_photo: filePath }
        : { detail_photo: filePath }
      const { error: updateError } = await supabase.from('maintenance').update(updatePayload).eq('id', m.id)
      if (updateError) throw updateError

      toast.success('Imagen actualizada')
      if (previewType === 'receipt') setReceiptPhoto(filePath)
      else setDetailPhoto(filePath)
      setSelectedFile(null)
    } catch (err) {
      console.error(err)
      toast.error('Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const dateStr = m.date ? m.date.replace(' ', 'T') : null
  const detailPath = `${basePath}/${vehicleId}/${m.id}`
  const editPath = `${basePath}/${vehicleId}/${m.id}/editar`

  return (
    <>
      <div className="card overflow-hidden hover:shadow-md transition-all group">
        {/* Franja de color por tipo */}
        <div className={clsx('h-1', m.type === 'regular' ? 'bg-brand-400' : 'bg-amber-400')} />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Ícono */}
            <div className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
              m.type === 'regular' ? 'bg-brand-50' : 'bg-amber-50'
            )}>
              <Wrench size={16} className={m.type === 'regular' ? 'text-brand-600' : 'text-amber-600'} />
            </div>

            {/* Contenido — clickeable para ver detalle */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(detailPath)}
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

              {/* Detalles */}
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
                    <span key={i} className="px-2 py-0.5 rounded-full bg-cream-100 text-slate-700 text-xs">
                      {s}
                    </span>
                  ))}
                  {services.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-cream-100 text-slate-600 text-xs">
                      +{services.length - 4} más
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-2">
                {receiptPhoto && (
                  <div className="inline-flex rounded-full border border-cream-200 bg-cream-50 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/boleta`)
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-cream-100 transition-colors"
                    >
                      <Image size={14} /> Boleta
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/boleta?mode=edit`)
                      }}
                      className="inline-flex items-center justify-center px-3 text-slate-700 bg-slate-50 hover:bg-cream-100 transition-colors"
                      title="Editar boleta"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                )}
                {detailPhoto && (
                  <div className="inline-flex rounded-full border border-cream-200 bg-cream-50 overflow-hidden shadow-sm">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/detalle`)
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-cream-100 transition-colors"
                    >
                      <FileText size={14} /> Detalles
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/mantenimiento/${vehicleId}/${m.id}/archivo/detalle?mode=edit`)
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
                <p className="text-xs text-slate-400 flex items-start gap-1 mt-1">
                  <FileText size={10} className="mt-0.5 flex-shrink-0" />
                  <span className="truncate">{m.notes}</span>
                </p>
              )}
            </div>

            {/* Botones de acción — completamente independientes del área clickeable */}
            <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
              <button
                type="button"
                onClick={() => navigate(editPath)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors"
                title="Editar"
              >
                <Edit size={15} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!previewType} onClose={closePreview} title={currentLabel} size="lg">
        <div className="space-y-4">
          <div className="rounded-3xl overflow-hidden bg-cream-100 h-72 flex items-center justify-center">
            {currentUrl ? (
              <ZoomImage src={currentUrl} alt={currentLabel} className="w-full h-full object-cover" type={currentIsPdf ? 'pdf' : undefined} />
            ) : (
              <div className="text-slate-400">No hay imagen disponible</div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Upload size={14} /> Seleccionar imagen
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={uploading}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Save size={14} /> Guardar
              </button>
            )}
            <button type="button" onClick={closePreview} className="btn-ghost">
              Cerrar
            </button>
          </div>
          {selectedFile && (
            <p className="text-sm text-slate-500">Se ha seleccionado una nueva imagen. Presiona Guardar para actualizarla.</p>
          )}
        </div>
      </Modal>

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
