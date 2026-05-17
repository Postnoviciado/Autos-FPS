import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true)
    try {
      await register(email, password, name)
      toast.success('¡Cuenta creada exitosamente! Revisa tu correo para confirmar tu cuenta si es necesario.')
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'confirm_email') {
        toast.success('Registrado correctamente. Revisa tu correo para confirmar la cuenta.')
      } else {
        const msg = err instanceof Error ? err.message : 'Error al registrar'
        toast.error(msg.includes('email') ? 'El correo ya está en uso' : 'Error al registrar')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-100/70 backdrop-blur mb-4 border border-cream-200">
            <Shield size={28} className="text-brand-900" />
          </div>
          <h1 className="font-display font-bold text-3xl text-cream-50">AutoControl</h1>
          <p className="text-cream-200 mt-1 text-sm">Crea tu cuenta</p>
        </div>
        <div className="bg-cream-50 rounded-2xl shadow-2xl p-8">
          <h2 className="font-display font-bold text-xl text-slate-900 mb-6">Crear cuenta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre completo</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Juan Pérez" required />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:underline">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
