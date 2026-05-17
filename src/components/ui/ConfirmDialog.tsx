import { useState } from 'react'
import Modal from './Modal'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  title?: string
  message?: string
  confirmLabel?: string
  doubleConfirm?: boolean
  doubleConfirmText?: string
}

export default function ConfirmDialog({
  open, onClose, onConfirm, loading,
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  doubleConfirm = false,
  doubleConfirmText = 'ELIMINAR',
}: Props) {
  const [step, setStep] = useState(1)
  const [typed, setTyped] = useState('')

  const handleClose = () => { setStep(1); setTyped(''); onClose() }
  const handleFirstConfirm = () => { if (doubleConfirm) setStep(2); else onConfirm() }
  const canConfirm2 = typed.trim().toUpperCase() === doubleConfirmText.toUpperCase()

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <div className="p-6 text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${step === 2 ? 'bg-red-100' : 'bg-amber-100'}`}>
          {step === 2
            ? <ShieldAlert size={26} className="text-red-600" />
            : <AlertTriangle size={26} className="text-amber-600" />}
        </div>

        {step === 1 && (
          <>
            <h3 className="font-display font-semibold text-slate-900 text-lg mb-2">{title}</h3>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={handleFirstConfirm} className="btn-danger flex-1 justify-center">
                {doubleConfirm ? 'Continuar →' : confirmLabel}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-display font-semibold text-red-700 text-lg mb-2">⚠️ Confirmación final</h3>
            <p className="text-slate-500 text-sm mb-3">
              Esto eliminará el vehículo y <strong>todo su historial de mantenimiento</strong> de forma permanente.
            </p>
            <p className="text-xs text-slate-400 mb-2">
              Escribe <span className="font-bold text-red-600">{doubleConfirmText}</span> para confirmar:
            </p>
            <input
              className="input text-center font-mono tracking-widest text-red-700 border-red-300 focus:ring-red-400/30 focus:border-red-400 mb-4"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={doubleConfirmText}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm2 || loading}
                className="btn-danger flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
