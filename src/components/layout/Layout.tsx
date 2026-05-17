import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LayoutDashboard, Car, Wrench, Bell, Settings, LogOut, Menu, ChevronRight, Shield, Users, Download } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', end: true },
  { to: '/vehiculos', icon: Car, label: 'Vehículos' },
  { to: '/mantenimiento', icon: Wrench, label: 'Mantenimiento' },
  { to: '/contactos', icon: Users, label: 'Contactos' },
  { to: '/responsables', icon: Users, label: 'Responsables' },
  { to: '/recordatorios', icon: Bell, label: 'Recordatorios' },
  { to: '/respaldo-informes', icon: Download, label: 'Respaldo e informes' },
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-amber-200 bg-amber-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-700 flex items-center justify-center shadow-lg shadow-amber-700/20">
            <Shield size={18} className="text-amber-100" />
          </div>
          <div>
            <span className="font-display font-semibold text-slate-900 text-sm uppercase tracking-[0.12em]">AutoControl</span>
            <p className="text-[11px] text-slate-600 leading-none mt-1">Gestión Vehicular</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-sm font-medium',
              isActive
                ? 'bg-amber-200 text-slate-900 border-l-4 border-amber-600 shadow-sm shadow-slate-300/40'
                : 'text-slate-700 hover:bg-amber-100 hover:text-slate-900'
            )}>
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-amber-700' : 'text-slate-500'} />
                <span className="flex-1 uppercase tracking-[0.02em]">{label}</span>
                {isActive && <ChevronRight size={14} className="text-amber-600" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-amber-200 mt-auto bg-amber-50">
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-amber-100">
          <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-white text-sm font-semibold">
            {user?.user_metadata?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.user_metadata?.name || 'Usuario'}</p>
            <p className="text-xs text-slate-600 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-3 mt-3 rounded-2xl text-sm text-slate-700 hover:bg-amber-200 hover:text-slate-900 transition-colors">
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-amber-50 overflow-hidden text-slate-900">
      <aside className="hidden lg:flex flex-col w-64 bg-amber-100 border-r border-amber-200 flex-shrink-0">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-amber-100 z-50 shadow-2xl border border-amber-200"><SidebarContent /></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-amber-100 border-b border-amber-200">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2 text-slate-900"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-700 flex items-center justify-center">
              <Shield size={12} className="text-amber-100" />
            </div>
            <span className="font-display font-bold text-slate-900 text-sm uppercase tracking-[0.12em]">AutoControl</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-amber-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
