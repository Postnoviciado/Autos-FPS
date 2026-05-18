import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, Wrench, ChevronRight, Gauge, Wind, Flame, FileCheck, ClipboardCheck } from 'lucide-react'
import type { Vehicle } from '@/types'
import { formatDate, getDateStatus, getMileageStatusWithAlert } from '@/lib/dateUtils'
import { getFileUrl } from '@/lib/supabase'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import VehicleModal from './VehicleModal'
import clsx from 'clsx'

interface Props {
  vehicle: Vehicle
  onUpdate: () => void
  hideNextMaintenance?: boolean
}

export default function VehicleCard({ vehicle, onUpdate, hideNextMaintenance }: Props) {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  const soatStatus = getDateStatus(vehicle.soat_expiry)
  const techStatus = getDateStatus(vehicle.tech_review_next)
  const extinStatus = getDateStatus(vehicle.extinguisher_renewal)

  const mileageStatus = getMileageStatusWithAlert(vehicle.current_mileage, vehicle.next_mileage, vehicle.mileage_alert_km ?? null)

  const pressureStatus = { level: vehicle.air_pressure ? 'valid' as const : 'none' as const, label: vehicle.air_pressure ? 'Registrado' : 'No registrado' }

  const worstLevel = [soatStatus, techStatus, extinStatus, mileageStatus].reduce((worst, s) => {
    const order = { expired: 0, urgent: 1, upcoming: 2, valid: 3, none: 4 }
    return order[s.level] < order[worst.level] ? s : worst
  }, { level: 'none' as const, label: '' })

  const cardAccent = { expired: 'border-l-red-500', urgent: 'border-l-red-400', upcoming: 'border-l-amber-400', valid: 'border-l-emerald-400', none: 'border-l-slate-200' }[worstLevel.level]
  const photoUrl = vehicle.photo ? getFileUrl('vehicles', vehicle.photo) : null

  return (
    <>
      <div className={clsx('card border-l-4 p-0 overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group', cardAccent)} onClick={() => setModalOpen(true)}>
        {/* Foto miniatura */}
        {photoUrl && (
          <div className="h-24 overflow-hidden">
            <img src={photoUrl} alt={vehicle.plate_number} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        <div className="px-5 pt-4 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Car size={20} className="text-brand-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-lg leading-tight tracking-wide">{vehicle.plate_number}</h3>
              <p className="text-xs text-slate-400 mt-2">
                {(vehicle.brand || vehicle.model)
                  ? `${vehicle.brand || ''}: ${vehicle.model || ''} (${vehicle.manufacture_year})`
                  : `Año ${vehicle.manufacture_year}`}
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors mt-1" />
        </div>

        <div className="px-5 pb-4 space-y-1">
          <StatRow icon={FileCheck} label="SOAT" status={soatStatus} value={formatDate(vehicle.soat_expiry)} />
          <StatRow icon={ClipboardCheck} label="Rev. Técnica" status={techStatus} value={formatDate(vehicle.tech_review_next)} />
          <StatRow icon={Flame} label="Extintor" status={extinStatus} value={formatDate(vehicle.extinguisher_renewal)} />
          <StatRow icon={Gauge} label="Km prox." status={mileageStatus} value={vehicle.next_mileage ? `${vehicle.next_mileage.toLocaleString()} km` : 'No registrado'} />
          <StatRow icon={Wind} label="Presión" status={pressureStatus} value={vehicle.air_pressure ? `${vehicle.air_pressure} PSI` : 'No registrado'} />
        </div>

        <div className="border-t border-cream-100 px-5 py-3 flex items-center justify-end bg-cream-100/90">
          <button onClick={e => { e.stopPropagation(); navigate(`/mantenimiento/${vehicle.id}`) }}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors">
            <Wrench size={13} /> Ver mantenimientos
          </button>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); onUpdate() }} title={`Vehículo ${vehicle.plate_number}`} size="lg">
        <VehicleModal vehicle={vehicle} hideNextMaintenance={hideNextMaintenance} onClose={() => { setModalOpen(false); onUpdate() }} />
      </Modal>
    </>
  )
}

function StatRow({ icon: Icon, label, status, value }: {
  icon: React.ElementType; label: string; status: ReturnType<typeof getDateStatus>; value: string
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-cream-100 transition-colors">
      <Icon size={13} className="text-slate-500 flex-shrink-0" />
      <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{label}</span>
        <StatusBadge status={status} />
      </div>
      <span className="text-xs text-slate-600 font-medium whitespace-nowrap ml-auto">{value}</span>
    </div>
  )
}
