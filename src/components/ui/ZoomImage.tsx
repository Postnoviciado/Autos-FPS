import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2, FileText } from 'lucide-react'

interface Props {
  src: string
  alt?: string
  className?: string
  type?: 'image' | 'pdf'
}

export default function ZoomImage({ src, alt = 'Imagen', className, type }: Props) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const isPdf = type === 'pdf' || src.toLowerCase().endsWith('.pdf') || /\.pdf($|\?)/i.test(src) || src.startsWith('data:application/pdf')
  const viewer = open ? createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}
      onClick={() => setOpen(false)}
    >
      {/* Barra de controles */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.5)', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{alt}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isPdf && (
            <>
              <button onClick={() => setScale(s => Math.max(s - 0.5, 0.5))} style={btnStyle} title="Alejar">
                <ZoomOut size={16} color="white" />
              </button>
              <button onClick={() => { setScale(1); setRotation(0) }} style={{ ...btnStyle, fontSize: 11, fontFamily: 'monospace', padding: '4px 8px' }}>
                {Math.round(scale * 100)}%
              </button>
              <button onClick={() => setScale(s => Math.min(s + 0.5, 5))} style={btnStyle} title="Acercar">
                <ZoomIn size={16} color="white" />
              </button>
              <button onClick={() => setRotation(r => (r + 90) % 360)} style={btnStyle} title="Rotar">
                <RotateCw size={16} color="white" />
              </button>
            </>
          )}
          <button onClick={() => setOpen(false)} style={{ ...btnStyle, marginLeft: 8 }} title="Cerrar">
            <X size={18} color="white" />
          </button>
        </div>
      </div>

      {/* Imagen / PDF */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {isPdf ? (
          <iframe
            src={src}
            title={alt}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            style={{
              width: `${scale * 100}%`,
              maxWidth: 'none',
              height: 'auto',
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease',
              objectFit: 'contain',
              userSelect: 'none',
            }}
            draggable={false}
            onClick={() => setScale(s => s < 3 ? s + 0.5 : 1)}
          />
        )}
      </div>

      {!isPdf && (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '8px 0', flexShrink: 0 }}>
          Clic en imagen para zoom · ESC para cerrar
        </p>
      )}
    </div>,
    document.body
  ) : null

  return (
    <>
      {/* Miniatura */}
      <div
        className="relative group cursor-zoom-in w-full h-full"
        onClick={e => { e.stopPropagation(); setScale(1); setRotation(0); setOpen(true) }}
      >
        {isPdf ? (
          <div className={`${className || 'w-full h-full'} flex items-center justify-center bg-slate-100 text-slate-500`}>
            <FileText size={40} />
          </div>
        ) : (
          <img src={src} alt={alt} className={className || 'w-full h-full object-cover'} />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center">
          <Maximize2 size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
        </div>
      </div>

      {viewer}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)',
  cursor: 'pointer', color: 'white',
}
