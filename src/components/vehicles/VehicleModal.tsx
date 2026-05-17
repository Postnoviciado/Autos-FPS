import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Loader2, Save, Gauge, Wind, FileCheck, ClipboardCheck, Flame, Calendar, X, Pencil } from 'lucide-react'
import type { Vehicle } from '@/types'
import { formatDate, formatDateInput, getDateStatus, getMileageStatus } from '@/lib/dateUtils'
import { format, parseISO, isValid, addYears } from 'date-fns'
import StatusBadge from '@/components/ui/StatusBadge'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import AddMaintenanceInline from '@/components/maintenance/AddMaintenanceInline'

interface Props { vehicle: Vehicle; onClose: () => void; hideNextMaintenance?: boolean }

export default function VehicleModal({ vehicle, onClose, hideNextMaintenance }: Props) {
  const navigate = useNavigate()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [showAddMaint, setShowAddMaint] = useState(false)
  const [vals, setVals] = useState({
    soat_expiry: formatDateInput(vehicle.soat_expiry),
    tech_review_last: formatDateInput(vehicle.tech_review_last),
    extinguisher_renewal: formatDateInput(vehicle.extinguisher_renewal),
    air_pressure: vehicle.air_pressure?.toString() || '',
    current_mileage: vehicle.current_mileage?.toString() || '',
    next_mileage: vehicle.next_mileage?.toString() || '',
  })
  const [saving, setSaving] = useState(false)

  const saveField = async (field: string) => {
    setSaving(true)
    try {
      const v = vals[field as keyof typeof vals]
      const dateFields = ['soat_expiry', 'tech_review_last', 'extinguisher_renewal']
      const payload: Record<string, unknown> = {}
      if (dateFields.includes(field)) payload[field] = v || null
      else payload[field] = v ? Number(v) : null
      if (field === 'tech_review_last') {
        const parsedDate = parseISO(v || '')
        const nextReview = v && isValid(parsedDate) ? addYears(parsedDate, 1) : null
        payload.tech_review_next = nextReview ? format(nextReview, 'yyyy-MM-dd') : null
      }
      const { error } = await supabase.from('vehicles').update(payload).eq('id', vehicle.id)
      if (error) throw error
      toast.success('Guardado')
      setEditingField(null)
      onClose()
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }

  const soatStatus = getDateStatus(vehicle.soat_expiry)
  const techStatus = getDateStatus(vehicle.tech_review_next)
  const extinStatus = getDateStatus(vehicle.extinguisher_renewal)
  const mileageStatus = getMileageStatus(vehicle.current_mileage, vehicle.next_mileage)

  const fields = [
    { key: 'soat_expiry', label: 'SOAT', icon: FileCheck, type: 'date' as const, display: formatDate(vehicle.soat_expiry), status: soatStatus },
    { key: 'tech_review_last', label: 'Última Rev. Técnica', icon: ClipboardCheck, type: 'date' as const, display: formatDate(vehicle.tech_review_last), status: techStatus },
    { key: 'extinguisher_renewal', label: 'Renovación Extintor', icon: Flame, type: 'date' as const, display: formatDate(vehicle.extinguisher_renewal), status: extinStatus },
    { key: 'current_mileage', label: 'Kilometraje actual', icon: Gauge, type: 'number' as const, display: vehicle.current_mileage ? `${vehicle.current_mileage.toLocaleString()} km` : 'No registrado', status: null },
    { key: 'next_mileage', label: 'Próximo mantenimiento (km)', icon: Gauge, type: 'number' as const, display: vehicle.next_mileage ? `${vehicle.next_mileage.toLocaleString()} km` : 'No registrado', status: mileageStatus },
    { key: 'air_pressure', label: 'Presión de neumáticos', icon: Wind, type: 'number' as const, display: vehicle.air_pressure ? `${vehicle.air_pressure} PSI` : 'No registrado', status: { level: vehicle.air_pressure ? 'valid' as const : 'none' as const, label: vehicle.air_pressure ? 'Registrado' : 'No registrado' } },
  ].filter((field) => !(hideNextMaintenance && field.key === 'next_mileage'))

  // Si el usuario quiere agregar mantenimiento, mostrar formulario inline
  if (showAddMaint) {
    return (
      <AddMaintenanceInline
        vehicle={vehicle}
        onDone={() => { setShowAddMaint(false); onClose() }}
        onCancel={() => setShowAddMaint(false)}
      />
    )
  }

  return (
    <div className="p-6">
      {/* Botones de acción */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setShowAddMaint(true)}
          className="btn-primary"
        >
          <Wrench size={14} /> Nuevo mantenimiento
        </button>
        <button
          onClick={() => {
            onClose()
            // Navegar directo al historial de ESTE vehículo
            navigate(`/mantenimiento/${vehicle.id}`)
          }}
          className="btn-secondary"
        >
          Ver historial →
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
        <Pencil size={10} /> Haz clic en cualquier campo para editarlo
      </p>

      <div className="space-y-2">
        {fields.map(({ key, label, icon: Icon, type, display, status }) => {
          const isEditing = editingField === key
          return (
            <div key={key}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isEditing ? 'border-brand-300 bg-brand-50' : 'border-cream-200 bg-cream-100 hover:border-cream-300 hover:bg-cream-200'}`}
              onClick={() => { if (!isEditing) setEditingField(key) }}>
              <Icon size={15} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                {isEditing ? (
                  <input type={type} value={vals[key as keyof typeof vals]}
                    onChange={e => setVals(f => ({ ...f, [key]: e.target.value }))}
                    className="input py-1 text-sm" autoFocus onClick={e => e.stopPropagation()} />
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800 text-sm">{display}</span>
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
              ) : <Pencil size={12} className="text-slate-300 flex-shrink-0" />}
            </div>
          )
        })}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-cream-200 bg-cream-100">
          <Calendar size={15} className="text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-600 flex-1">Año de fabricación</span>
          <span className="font-medium text-slate-900 text-sm">{vehicle.manufacture_year}</span>
        </div>
      </div>
    </div>
  )
}
