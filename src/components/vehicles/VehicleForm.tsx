import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle } from '@/types'
import { formatDateInput } from '@/lib/dateUtils'
import { Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props { vehicle?: Vehicle }

export default function VehicleForm({ vehicle }: Props) {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    plate_number: vehicle?.plate_number || '',
    brand: vehicle?.brand || '',
    model: vehicle?.model || '',
    manufacture_year: vehicle?.manufacture_year?.toString() || new Date().getFullYear().toString(),
    soat_expiry: formatDateInput(vehicle?.soat_expiry),
    tech_review_last: formatDateInput(vehicle?.tech_review_last),
    tech_review_next: formatDateInput(vehicle?.tech_review_next),
    extinguisher_renewal: formatDateInput(vehicle?.extinguisher_renewal),
    air_pressure: vehicle?.air_pressure?.toString() || '',
    current_mileage: vehicle?.current_mileage?.toString() || '',
    next_mileage: vehicle?.next_mileage?.toString() || '',
    mileage_alert_km: vehicle?.mileage_alert_km?.toString() || '500',
  })

  const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleMileageChange = (val: string) => {
    set('current_mileage', val)
    if (!vehicle && val) set('next_mileage', (Number(val) + 5000).toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      const data = {
        user_id: user.id,
        plate_number: form.plate_number.toUpperCase().replace(/\s/g, ''),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        manufacture_year: Number(form.manufacture_year),
        soat_expiry: form.soat_expiry || null,
        tech_review_last: form.tech_review_last || null,
        tech_review_next: form.tech_review_next || null,
        extinguisher_renewal: form.extinguisher_renewal || null,
        air_pressure: form.air_pressure ? Number(form.air_pressure) : null,
        current_mileage: form.current_mileage ? Number(form.current_mileage) : null,
        next_mileage: form.next_mileage ? Number(form.next_mileage) : null,
        mileage_alert_km: form.mileage_alert_km ? Number(form.mileage_alert_km) : 500,
      }
      if (vehicle) {
        const { error } = await supabase.from('vehicles').update(data).eq('id', vehicle.id)
        if (error) throw error
        toast.success('Vehículo actualizado')
        navigate('/vehiculos')
      } else {
        const { error } = await supabase.from('vehicles').insert(data)
        if (error) throw error
        toast.success('Vehículo registrado')
        navigate('/vehiculos')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg.includes('plate_number') ? 'La placa ya está registrada' : 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/vehiculos')} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
        <h1 className="page-title">{vehicle ? 'Editar vehículo' : 'Nuevo vehículo'}</h1>
      </div>
      <div className="card p-6 space-y-5">
        <h2 className="section-title">Información básica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Placa <span className="text-red-500">*</span></label>
            <input className="input uppercase" value={form.plate_number} onChange={e => set('plate_number', e.target.value.toUpperCase())} placeholder="ABC-123" required /></div>
          <div><label className="label">Marca <span className="text-red-500">*</span></label>
            <input className="input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Toyota" required /></div>
          <div><label className="label">Modelo <span className="text-red-500">*</span></label>
            <input className="input" value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" required /></div>
          <div><label className="label">Año de fabricación <span className="text-red-500">*</span></label>
            <input type="number" className="input" value={form.manufacture_year} onChange={e => set('manufacture_year', e.target.value)} min={1900} max={new Date().getFullYear() + 1} required /></div>
        </div>
      </div>
      <div className="card p-6 space-y-5">
        <h2 className="section-title">Documentos y fechas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Vencimiento SOAT</label><input type="date" className="input" value={form.soat_expiry} onChange={e => set('soat_expiry', e.target.value)} /></div>
          <div><label className="label">Última revisión técnica</label><input type="date" className="input" value={form.tech_review_last} onChange={e => set('tech_review_last', e.target.value)} /></div>
          <div><label className="label">Próxima revisión técnica</label><input type="date" className="input" value={form.tech_review_next} onChange={e => set('tech_review_next', e.target.value)} /></div>
          <div><label className="label">Renovación extintor</label><input type="date" className="input" value={form.extinguisher_renewal} onChange={e => set('extinguisher_renewal', e.target.value)} /></div>
        </div>
      </div>
      <div className="card p-6 space-y-5">
        <h2 className="section-title">Kilometraje y alertas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Kilometraje actual</label><input type="number" className="input" value={form.current_mileage} onChange={e => handleMileageChange(e.target.value)} placeholder="km" min={0} /></div>
          <div><label className="label">Próximo mantenimiento (km)</label><input type="number" className="input" value={form.next_mileage} onChange={e => set('next_mileage', e.target.value)} placeholder="km" min={0} /></div>
          <div><label className="label">Presión de neumáticos (PSI)</label><input type="number" className="input" value={form.air_pressure} onChange={e => set('air_pressure', e.target.value)} placeholder="PSI" min={0} max={100} /></div>
          <div><label className="label">Avisar cuando falten (km)</label>
            <input type="number" className="input" value={form.mileage_alert_km} onChange={e => set('mileage_alert_km', e.target.value)} placeholder="500" min={50} />
            <p className="text-xs text-slate-400 mt-1">Recordatorio automático de kilometraje</p>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => navigate('/vehiculos')} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading && <Loader2 size={15} className="animate-spin" />}
          {vehicle ? 'Guardar cambios' : 'Registrar vehículo'}
        </button>
      </div>
    </form>
  )
}
