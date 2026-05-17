import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle } from '@/types'
import VehicleCard from '@/components/vehicles/VehicleCard'
import ObservationsPanel from '@/components/observations/ObservationsPanel'
import { Car, Plus, Loader2, AlertTriangle, Bell } from 'lucide-react'
import { getDateStatus, getMileageStatusWithAlert } from '@/lib/dateUtils'
import EmptyState from '@/components/ui/EmptyState'
import { useAutoReminders } from '@/hooks/useAutoReminders'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  const load = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('plate_number', { ascending: true })
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.warn('Failed to load vehicles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user, refresh])

  // Recordatorios automáticos: SOAT y Rev. Técnica próximos a vencer
  useAutoReminders(user?.id, vehicles)

  // Alertas críticas y próximas a vencer por item, no por vehículo
  const issueEntries = vehicles.flatMap((v) => {
    const extinguisherStatus = v.extinguisher_renewal
      ? getDateStatus(v.extinguisher_renewal)
      : { level: 'expired' as const, label: 'Extintor sin fecha', daysRemaining: -1 }

    return [
      getDateStatus(v.soat_expiry),
      getDateStatus(v.tech_review_next),
      extinguisherStatus,
      getMileageStatusWithAlert(v.current_mileage, v.next_mileage, v.mileage_alert_km ?? null),
    ].filter((status) => status.level !== 'none')
  })

  const criticalAlerts = issueEntries.filter((status) => status.level === 'expired' || status.level === 'urgent')
  const upcomingAlerts = issueEntries.filter((status) => status.level === 'upcoming')
  const criticalVehicles = vehicles.filter((v) => {
    const extinguisherStatus = v.extinguisher_renewal
      ? getDateStatus(v.extinguisher_renewal)
      : { level: 'expired' as const, label: 'Extintor sin fecha', daysRemaining: -1 }

    const statuses = [
      getDateStatus(v.soat_expiry),
      getDateStatus(v.tech_review_next),
      extinguisherStatus,
      getMileageStatusWithAlert(v.current_mileage, v.next_mileage, v.mileage_alert_km ?? null),
    ]
    return statuses.some((s) => s.level === 'expired' || s.level === 'urgent')
  })
  const criticalVehicleCount = criticalVehicles.length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Inicio</h1>
          <p className="text-slate-400 text-sm mt-0.5">Bienvenido, {user?.user_metadata?.name || user?.email}</p>
        </div>
        <button onClick={() => navigate('/vehiculos/agregar')} className="btn-primary">
          <Plus size={16} />
          Nuevo vehículo
        </button>
      </div>

      {/* Stats bar */}
      {!loading && vehicles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Vehículos" value={vehicles.length} color="blue" />
          <StatCard label="Alertas críticas" value={criticalAlerts.length} color={criticalAlerts.length > 0 ? 'red' : 'green'} />
          <StatCard label="Al día" value={Math.max(0, vehicles.length - criticalVehicleCount)} color="green" />
          <StatCard
            label="Próx. a vencer"
            value={upcomingAlerts.length}
            color="amber"
          />
        </div>
      )}

      {/* Critical alert banner */}
      {criticalAlerts.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {criticalVehicleCount} vehículo{criticalVehicleCount !== 1 ? 's' : ''} requiere{criticalVehicleCount === 1 ? '' : 'n'} atención urgente
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {criticalVehicles.map((v) => v.plate_number).join(', ')}
            </p>
          </div>
          <button onClick={() => navigate('/recordatorios')} className="ml-auto flex items-center gap-1 text-xs text-red-600 font-medium hover:underline whitespace-nowrap">
            <Bell size={12} /> Ver recordatorios
          </button>
        </div>
      )}

      {/* Vehicles grid */}
      <div>
        <h2 className="section-title mb-4">Flota vehicular</h2>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-300" />
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No hay vehículos registrados"
            description="Agrega tu primer vehículo para comenzar a gestionar el mantenimiento."
            action={
              <button onClick={() => navigate('/vehiculos/agregar')} className="btn-primary">
                <Plus size={15} /> Agregar vehículo
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} onUpdate={() => setRefresh((r) => r + 1)} hideNextMaintenance />
            ))}
          </div>
        )}
      </div>

      {/* Observations */}
      <ObservationsPanel />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'red' | 'green' | 'amber' }) {
  const styles = {
    blue: 'bg-brand-50 text-brand-700 border-brand-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-amber-50 text-amber-700 border-amber-100',
    amber: 'bg-cream-100 text-brand-700 border-cream-200',
  }
  return (
    <div className={`card border p-4 ${styles[color]}`}>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  )
}
