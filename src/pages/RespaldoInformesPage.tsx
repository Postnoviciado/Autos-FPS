import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Vehicle, Maintenance, BackupData } from '@/types'
import { exportMaintenanceReportExcel, exportMaintenanceReportPDF } from '@/lib/reportUtils'
import EmptyState from '@/components/ui/EmptyState'
import { Download, Upload, FileJson, Loader2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return 'Error desconocido' }
}

export default function RespaldoInformesPage() {
  const user = useAuthStore((s) => s.user)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<'general' | 'vehicle'>('general')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState(false)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        const vehiclesRes = await supabase.from('vehicles')
          .select('*')
          .eq('user_id', user.id)
          .order('plate_number', { ascending: true })

        if (vehiclesRes.error) throw vehiclesRes.error
        const vehiclesData = vehiclesRes.data || []
        setVehicles(vehiclesData)

        const vehicleIds = vehiclesData.map((v) => v.id)
        if (vehicleIds.length > 0) {
          const maintRes = await supabase.from('maintenance')
            .select('*')
            .in('vehicle_id', vehicleIds)
            .order('date', { ascending: false })
          if (maintRes.error) throw maintRes.error
          setMaintenances(maintRes.data || [])
        } else {
          setMaintenances([])
        }
      } catch (err) {
        console.error('Error cargando datos de respaldo e informes:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handleExportBackup = async () => {
    if (!user) return
    setExportingBackup(true)

    try {
      const vehiclesRes = await supabase.from('vehicles').select('*').eq('user_id', user.id)
      if (vehiclesRes.error) throw vehiclesRes.error
      const vehicleIds = vehiclesRes.data?.map((v) => v.id) || []

      const maintRes = vehicleIds.length > 0
        ? await supabase.from('maintenance').select('*').in('vehicle_id', vehicleIds)
        : { data: [], error: null }
      const observationsRes = await supabase.from('observations').select('*').eq('user_id', user.id)
      const remindersRes = await supabase.from('reminders').select('*').eq('user_id', user.id)
      const reminderSettingsRes = await supabase.from('reminder_settings').select('*').eq('user_id', user.id).single()
      const contactsRes = await supabase.from('contacts').select('*').eq('user_id', user.id)

      if (maintRes.error) throw maintRes.error
      if (observationsRes.error) throw observationsRes.error
      if (remindersRes.error) throw remindersRes.error
      if (reminderSettingsRes.error && reminderSettingsRes.error.code !== 'PGRST116') throw reminderSettingsRes.error
      if (contactsRes.error) throw contactsRes.error

      const backup: BackupData = {
        version: '1.0',
        user_id: user.id,
        timestamp: new Date().toISOString(),
        vehicles: vehiclesRes.data || [],
        maintenances: maintRes.data || [],
        observations: observationsRes.data || [],
        reminders: remindersRes.data || [],
        reminder_settings: reminderSettingsRes.data || null,
        contacts: contactsRes.data || [],
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `autocontrol-backup-${user.id}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(`No se pudo crear el backup: ${msg}`)
    } finally {
      setExportingBackup(false)
    }
  }

  const handleRestoreBackup = async (backup: BackupData) => {
    if (!user) return
    if (backup.user_id !== user.id) {
      throw new Error('El backup corresponde a otro usuario.')
    }

    if (!window.confirm('Restaurar el backup reemplazará todos sus datos actuales. ¿Desea continuar?')) {
      return
    }

    setRestoringBackup(true)
    try {
      const currentVehiclesRes = await supabase.from('vehicles').select('id').eq('user_id', user.id)
      if (currentVehiclesRes.error) throw currentVehiclesRes.error
      const currentVehicleIds = currentVehiclesRes.data?.map((v) => v.id) ?? []

      if (currentVehicleIds.length > 0) {
        await Promise.all([
          supabase.from('maintenance').delete().in('vehicle_id', currentVehicleIds),
          supabase.from('reminders').delete().in('vehicle_id', currentVehicleIds),
        ])
      }

      await Promise.all([
        supabase.from('vehicles').delete().eq('user_id', user.id),
        supabase.from('observations').delete().eq('user_id', user.id),
        supabase.from('contacts').delete().eq('user_id', user.id),
        supabase.from('reminder_settings').delete().eq('user_id', user.id),
      ])

      if (backup.vehicles.length > 0) {
        const { error } = await supabase.from('vehicles').insert(backup.vehicles)
        if (error) throw error
      }
      if (backup.contacts.length > 0) {
        const { error } = await supabase.from('contacts').insert(backup.contacts)
        if (error) throw error
      }
      if (backup.observations.length > 0) {
        const { error } = await supabase.from('observations').insert(backup.observations)
        if (error) throw error
      }
      if (backup.reminders.length > 0) {
        const { error } = await supabase.from('reminders').insert(backup.reminders)
        if (error) throw error
      }
      if (backup.maintenances.length > 0) {
        const { error } = await supabase.from('maintenance').insert(backup.maintenances)
        if (error) throw error
      }
      if (backup.reminder_settings) {
        const { error } = await supabase.from('reminder_settings').insert(backup.reminder_settings)
        if (error) throw error
      }

      toast.success('Backup restaurado correctamente')
      setSelectedVehicleId('')
      setReportType('general')
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(`No se pudo restaurar el backup: ${msg}`)
    } finally {
      setRestoringBackup(false)
    }
  }

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text) as BackupData
      await handleRestoreBackup(parsed)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      toast.error(`Archivo inválido: ${msg}`)
    } finally {
      e.target.value = ''
    }
  }

  const handleExportExcel = () => {
    setExportingExcel(true)
    try {
      const vehicleId = reportType === 'vehicle' ? selectedVehicleId : undefined
      const title = reportType === 'vehicle'
        ? `Reporte_${vehicles.find((v) => v.id === vehicleId)?.plate_number || 'vehiculo'}`
        : 'Reporte_mantenimiento'
      exportMaintenanceReportExcel(vehicles, maintenances, title, vehicleId)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo exportar el reporte Excel')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportPDF = () => {
    setExportingPDF(true)
    try {
      const vehicleId = reportType === 'vehicle' ? selectedVehicleId : undefined
      const title = reportType === 'vehicle'
        ? `Reporte_${vehicles.find((v) => v.id === vehicleId)?.plate_number || 'vehiculo'}`
        : 'Reporte_mantenimiento'
      exportMaintenanceReportPDF(vehicles, maintenances, title, vehicleId)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo exportar el reporte PDF')
    } finally {
      setExportingPDF(false)
    }
  }

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
        icon={Shield}
        title="Acceso no autorizado"
        description="Inicia sesión para acceder a los respaldos e informes."
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Respaldo e informes</h1>
        <p className="text-slate-400 text-sm mt-0.5">Descarga o restaura tu información y genera reportes de mantenimiento.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-brand-600" />
            <h2 className="section-title">Respaldo</h2>
          </div>
          <p className="text-sm text-slate-500">
            Descarga un archivo JSON con tus datos actuales. Puedes restaurarlo después en esta cuenta. No se incluyen imágenes almacenadas en Supabase, solo registros de la base de datos.
          </p>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <strong>Advertencia:</strong> Restaurar un backup reemplazará todos los datos actuales de tu cuenta. Asegúrate de tener una copia válida antes de continuar.
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button onClick={handleExportBackup} disabled={exportingBackup} className="btn-secondary w-full">
              {exportingBackup ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {exportingBackup ? 'Generando...' : 'Crear backup'}
            </button>
            <label htmlFor="backup-file-input" className="btn-secondary w-full justify-center cursor-pointer">
              {restoringBackup ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {restoringBackup ? 'Restaurando...' : 'Restaurar backup'}
            </label>
          </div>
          <input
            id="backup-file-input"
            type="file"
            accept="application/json"
            onChange={handleImportBackupFile}
            className="hidden"
            disabled={restoringBackup}
          />
        </div>

        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FileJson size={18} className="text-brand-600" />
            <h2 className="section-title">Reportes de mantenimiento</h2>
          </div>
          <p className="text-sm text-slate-500">
            Genera archivos Excel o PDF con el historial de mantenimiento general o por vehículo.
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="general"
                  checked={reportType === 'general'}
                  onChange={(e) => setReportType(e.target.value as 'general' | 'vehicle')}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700">General (todos los vehículos)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="vehicle"
                  checked={reportType === 'vehicle'}
                  onChange={(e) => setReportType(e.target.value as 'general' | 'vehicle')}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700">Vehículo específico</span>
              </label>
            </div>

            {reportType === 'vehicle' && (
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="input"
              >
                <option value="">-- Selecciona un vehículo --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number} {v.brand ? `| ${v.brand}` : ''} {v.model ? v.model : ''}
                  </option>
                ))}
              </select>
            )}

            <div className="flex flex-col gap-3 sm:flex-row pt-2">
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel || (reportType === 'vehicle' && !selectedVehicleId)}
                className="btn-secondary flex-1"
              >
                {exportingExcel ? 'Generando...' : 'Descargar Excel'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF || (reportType === 'vehicle' && !selectedVehicleId)}
                className="btn-secondary flex-1"
              >
                {exportingPDF ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
