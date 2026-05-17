import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import VehiclesPage from '@/pages/VehiclesPage'
import AddVehiclePage from '@/pages/AddVehiclePage'
import MantenimientoPage from '@/pages/MantenimientoPage'
import VehicleDetailPage from '@/pages/VehicleDetailPage'
import AddMaintenancePage from '@/pages/AddMaintenancePage'
import MaintenanceDetailPage from '@/pages/MaintenanceDetailPage'
import MaintenanceFilePage from '@/pages/MaintenanceFilePage'
import EditMaintenancePage from '@/pages/EditMaintenancePage'
import ContactsPage from '@/pages/ContactsPage'
import ResponsiblesPage from '@/pages/ResponsiblesPage'
import RemindersPage from '@/pages/RemindersPage'
import SettingsPage from '@/pages/SettingsPage'
import RespaldoInformesPage from '@/pages/RespaldoInformesPage'
import PropertyCardPage from '@/pages/PropertyCardPage'
import { useReminderNotifications } from '@/hooks/useReminderNotifications'

function Protected({ children }: { children: React.ReactNode }) {
  const ok = useAuthStore(s => s.isAuthenticated)
  if (!ok) return <Navigate to="/login" replace />
  return <>{children}</>
}
function Public({ children }: { children: React.ReactNode }) {
  const ok = useAuthStore(s => s.isAuthenticated)
  if (ok) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const init = useAuthStore(s => s.init)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    let cleanup: (() => void) | undefined
    let active = true

    const initialize = async () => {
      const unsubscribe = await init()
      if (!active && unsubscribe) {
        unsubscribe()
        return
      }
      cleanup = unsubscribe
    }

    initialize()

    return () => {
      active = false
      cleanup?.()
    }
  }, [init])

  useReminderNotifications(user?.id)

  return (
    <Routes>
      <Route path="/login" element={<Public><LoginPage /></Public>} />
      <Route path="/register" element={<Public><RegisterPage /></Public>} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="vehiculos" element={<VehiclesPage />} />
        <Route path="vehiculos/agregar" element={<AddVehiclePage />} />
        <Route path="vehiculos/:id/tarjeta" element={<PropertyCardPage />} />
        <Route path="mantenimiento" element={<MantenimientoPage />} />
        <Route path="mantenimiento/:id" element={<VehicleDetailPage />} />
        <Route path="mantenimiento/:id/agregar" element={<AddMaintenancePage />} />
        <Route path="mantenimiento/:id/:maintenanceId" element={<MaintenanceDetailPage />} />
        <Route path="mantenimiento/:id/:maintenanceId/archivo/:fileType" element={<MaintenanceFilePage />} />
        <Route path="mantenimiento/:id/:maintenanceId/editar" element={<EditMaintenancePage />} />
        <Route path="contactos" element={<ContactsPage />} />
        <Route path="responsables" element={<ResponsiblesPage />} />
        <Route path="recordatorios" element={<RemindersPage />} />
        <Route path="respaldo-informes" element={<RespaldoInformesPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
