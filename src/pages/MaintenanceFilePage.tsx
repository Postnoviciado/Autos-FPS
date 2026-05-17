import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import type { Maintenance, Vehicle } from '@/types'
import { ArrowLeft, FileText, Loader2, Upload, Save } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import ImageZoomViewer from '@/components/ui/ImageZoomViewer'
import toast from 'react-hot-toast'

export default function MaintenanceFilePage() {
  const { id, maintenanceId, fileType } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const editMode = searchParams.get('mode') === 'edit'

  useEffect(() => {
    if (!id || !maintenanceId) return

    const load = async () => {
      try {
        const [vRes, mRes] = await Promise.all([
          supabase.from('vehicles').select('*').eq('id', id).single(),
          supabase.from('maintenance').select('*').eq('id', maintenanceId).single(),
        ])
        if (vRes.error) throw vRes.error
        if (mRes.error) throw mRes.error
        setVehicle(vRes.data)
        setMaintenance(mRes.data)
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setError(`No se pudo cargar el archivo. ${message}`)
        toast.error('No se pudo cargar el archivo.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, maintenanceId])

  useEffect(() => {
    if (!previewUrl) return
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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

  const handleSave = async () => {
    if (!id || !maintenanceId || !selectedFile) return
    setSaving(true)
    try {
      const ext = selectedFile.name.split('.').pop() ?? 'jpg'
      const fileName = `${fileType}-${Date.now()}.${ext}`
      const filePath = `${id}/${maintenanceId}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('maintenance').upload(filePath, selectedFile, { upsert: true })
      if (uploadError) throw uploadError

      const updatePayload = fileType === 'boleta'
        ? { receipt_photo: filePath }
        : { detail_photo: filePath }

      const { error: updateError } = await supabase.from('maintenance').update(updatePayload).eq('id', maintenanceId)
      if (updateError) throw updateError

      setMaintenance(prev => prev ? { ...prev, ...updatePayload } : prev)
      setSelectedFile(null)
      setPreviewUrl(null)
      toast.success('Archivo actualizado')
    } catch (err) {
      console.error(err)
      toast.error('Error al actualizar el archivo')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-slate-300" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Error al cargar"
        description={error}
        action={
          <button type="button" onClick={() => navigate(`/mantenimiento/${id}`)} className="btn-primary">
            Volver
          </button>
        }
      />
    )
  }

  if (!vehicle || !maintenance) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="No encontrado"
        description="No se encontró el mantenimiento o el vehículo."
        action={
          <button type="button" onClick={() => navigate('/mantenimiento')} className="btn-primary">
            Volver a mantenimiento
          </button>
        }
      />
    )
  }

  const fileKey = fileType === 'boleta' ? maintenance.receipt_photo : maintenance.detail_photo
  const label = fileType === 'boleta' ? 'Boleta de pago' : 'Detalle del mantenimiento'
  const fileUrl = selectedFile && previewUrl ? previewUrl : fileKey ? getFileUrl('maintenance', fileKey) : null
  const isPdf = selectedFile
    ? selectedFile.type === 'application/pdf' || (previewUrl?.toLowerCase().endsWith('.pdf') ?? false)
    : (fileUrl?.toLowerCase().endsWith('.pdf') ?? false)

  if (!fileUrl && !selectedFile) {
    return (
      <EmptyState
        icon={FileText}
        title="Archivo no disponible"
        description={`No hay ${fileType === 'boleta' ? 'boleta' : 'detalle'} cargado para este mantenimiento.`}
        action={
          <button type="button" onClick={() => navigate(`/mantenimiento/${id}/${maintenanceId}`)} className="btn-primary">
            Volver al mantenimiento
          </button>
        }
      />
    )
  }

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-900'}`

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(`/mantenimiento/${id}`)} className="btn-ghost p-2">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title tracking-widest">{label}</h1>
            <p className="text-slate-400 text-sm">Vehículo {vehicle.plate_number}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-cream-200 bg-cream-50 p-2">
        <button
          type="button"
          onClick={() => navigate(`/mantenimiento/${id}/${maintenanceId}/archivo/boleta${editMode ? '?mode=edit' : ''}`)}
          className={tabClass(fileType === 'boleta')}
        >
          Boleta
        </button>
        <button
          type="button"
          onClick={() => navigate(`/mantenimiento/${id}/${maintenanceId}/archivo/detalle${editMode ? '?mode=edit' : ''}`)}
          className={tabClass(fileType === 'detalle')}
        >
          Detalles
        </button>
        {editMode && (
          <span className="ml-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Modo edición
          </span>
        )}
      </div>

      {editMode && (
        <div className="card p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <p className="text-slate-500">Selecciona un nuevo archivo para reemplazar lo actual.</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              <Upload size={14} /> Seleccionar archivo
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
            <div className="mb-4 rounded-3xl border border-cream-200 bg-cream-50 p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Archivo seleccionado: {selectedFile.name}</p>
              <div className="rounded-2xl overflow-hidden bg-slate-100 h-72">
                {selectedFile.type === 'application/pdf' ? (
                  <iframe src={previewUrl ?? ''} title="Vista previa del PDF" className="w-full h-full border-none" />
                ) : (
                  <ImageZoomViewer src={previewUrl ?? ''} alt={selectedFile.name} />
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedFile || saving}
              className="btn-primary"
            >
              <Save size={14} /> Guardar archivo
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
        </div>
      )}

      <div className="rounded-3xl border border-cream-200 overflow-hidden bg-cream-50 min-h-[60vh]">
        {isPdf ? (
          <iframe src={fileUrl ?? ''} title={label} className="w-full h-[80vh] min-h-[480px]" />
        ) : (
          fileUrl ? <ImageZoomViewer src={fileUrl} alt={label} /> : null
        )}
      </div>
    </div>
  )
}
