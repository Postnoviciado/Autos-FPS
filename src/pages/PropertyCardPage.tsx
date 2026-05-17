import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import type { Vehicle } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import ImageZoomViewer from '@/components/ui/ImageZoomViewer'
import { ArrowLeft, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function PropertyCardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVehicle = async () => {
    if (!id) {
      setError('ID de vehículo no válido.')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single()
      if (error) throw error
      setVehicle(data)
    } catch (err) {
      console.error('Error al cargar vehículo:', err)
      const message = err instanceof Error ? err.message : String(err)
      setError(`No se pudo cargar la tarjeta de propiedad. ${message}`)
      toast.error('No se pudo cargar la tarjeta de propiedad.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicle()
  }, [id])

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
          <button type="button" onClick={() => navigate('/vehiculos')} className="btn-primary">
            Volver a vehículos
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
        description={`No se encontró el vehículo con ID ${id}.`}
        action={
          <button type="button" onClick={() => navigate('/vehiculos')} className="btn-primary">
            Volver a vehículos
          </button>
        }
      />
    )
  }

  const propertyCardUrl = vehicle.property_card ? getFileUrl('vehicles', vehicle.property_card) : null
  const isPdf = propertyCardUrl?.toLowerCase().endsWith('.pdf') ?? false

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/vehiculos')} className="btn-ghost p-2">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title tracking-widest">Tarjeta de propiedad</h1>
            <p className="text-slate-400 text-sm">Vehículo {vehicle.plate_number}</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/vehiculos')} className="btn-secondary">
          <FileText size={14} /> Volver
        </button>
      </div>

      <div className="rounded-3xl border border-cream-200 overflow-hidden bg-cream-50 min-h-[480px]">
        {propertyCardUrl ? (
          isPdf ? (
            <iframe src={propertyCardUrl} title="Tarjeta de propiedad" className="w-full h-[80vh] min-h-[480px]" />
          ) : (
            <ImageZoomViewer src={propertyCardUrl} alt="Tarjeta de propiedad" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-slate-500">
            <ImageIcon size={48} />
            <h2 className="text-lg font-semibold">No hay tarjeta de propiedad guardada</h2>
            <p className="max-w-md text-center text-sm text-slate-400">
              Este vehículo no tiene un archivo de tarjeta de propiedad cargado aún.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
