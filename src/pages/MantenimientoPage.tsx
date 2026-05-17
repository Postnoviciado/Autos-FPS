import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, getFileUrl } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle, Maintenance } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import { Car, Loader2 } from 'lucide-react'

export default function MantenimientoPage() {
  const user = useAuthStore((s) => s.user)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadVehicles = async () => {
      try {
        const { data, error } = await supabase.from('vehicles')
          .select('*')
          .eq('user_id', user.id)
          .order('plate_number', { ascending: true })
        if (error) throw error
        const vehiclesData = data || []
        setVehicles(vehiclesData)

        const vehicleIds = vehiclesData.map((v) => v.id)
        if (vehicleIds.length > 0) {
          const { data: maintData, error: maintError } = await supabase
            .from('maintenance')
            .select('*')
            .in('vehicle_id', vehicleIds)
            .order('date', { ascending: false })
          if (maintError) throw maintError
          setMaintenances(maintData || [])
        } else {
          setMaintenances([])
        }
      } catch (err: any) {
        console.warn('Failed to load vehicles for maintenance:', err)
      } finally {
        setLoading(false)
      }
    }
    loadVehicles()
  }, [user])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <EmptyState
        icon={Car}
        title="Acceso no autorizado"
        description="Inicia sesión para ver el mantenimiento de tus vehículos."
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Mantenimiento</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Selecciona un vehículo para ver su historial
        </p>
      </div>
      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Sin vehículos"
          description="Agrega vehículos primero desde el menú Vehículos."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {vehicles.map((v) => (
            <Link
              key={v.id}
              to={`/mantenimiento/${encodeURIComponent(v.id)}`}
              className="card border-l-4 border-l-slate-200 p-4 text-left hover:shadow-md transition-all duration-200 group w-full"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-cream-100 flex-shrink-0 flex items-center justify-center">
                  {v.photo ? (
                    <img src={getFileUrl('vehicles', v.photo)} className="w-full h-full object-cover" alt={v.plate_number} />
                  ) : (
                    <Car size={20} className="text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-slate-900 tracking-wide text-base">
                    {v.plate_number}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(v.brand || v.model)
                      ? `${v.brand || ''}: ${v.model || ''} (${v.manufacture_year})`
                      : `Año ${v.manufacture_year}`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
