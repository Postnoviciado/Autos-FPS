import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Vehicle, Maintenance } from '@/types'
import MaintenanceForm from '@/components/maintenance/MaintenanceForm'
import { Loader2 } from 'lucide-react'

export default function EditMaintenancePage() {
  const { id, maintenanceId } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null)
  const [loading, setLoading] = useState(true)

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
      .catch(() => navigate(`/mantenimiento/${id}`))
      .finally(() => setLoading(false))
  }, [id, maintenanceId])

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
  if (!vehicle || !maintenance) return null
  return <MaintenanceForm vehicle={vehicle} maintenance={maintenance} backPath={`/mantenimiento/${id}`} />
}
