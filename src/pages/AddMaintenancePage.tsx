import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Vehicle } from '@/types'
import MaintenanceForm from '@/components/maintenance/MaintenanceForm'
import { Loader2 } from 'lucide-react'

export default function AddMaintenancePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const loadVehicle = async () => {
      try {
        const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single()
        if (error) throw error
        setVehicle(data)
      } catch (err: any) {
        console.error(err)
        navigate('/mantenimiento')
      } finally {
        setLoading(false)
      }
    }
    loadVehicle()
  }, [id])

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-slate-300" /></div>
  if (!vehicle) return null
  return <MaintenanceForm vehicle={vehicle} backPath={`/mantenimiento/${id}`} />
}
