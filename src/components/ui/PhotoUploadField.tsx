import { useRef } from 'react'
import { Camera, Upload, Trash2, ImageIcon } from 'lucide-react'
import ZoomImage from './ZoomImage'

interface Props {
  label: string
  currentUrl?: string
  onFileSelected: (file: File | null) => void
  previewUrl?: string
  previewType?: 'image' | 'pdf'
  compact?: boolean
}

const isPdfUrl = (url?: string) => {
  if (!url) return false
  return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?') || url.startsWith('data:application/pdf')
}

export default function PhotoUploadField({ label, currentUrl, onFileSelected, previewUrl, previewType, compact }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const displayUrl = previewUrl || currentUrl
  const isPdf = previewType === 'pdf' || isPdfUrl(displayUrl)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFileSelected(f)
    e.target.value = ''
  }

  return (
    <div>
      <label className="label">{label}</label>

      {/* Input galería — sin capture */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleChange}
      />
      {/* Input cámara — con capture */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {/* Vista previa */}
      <div className={`rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center bg-cream-100 mb-2 ${compact ? 'h-28' : 'h-40'} border-cream-200`}>
        {displayUrl ? (
          isPdf ? (
            <ZoomImage src={displayUrl} alt={label} className="w-full h-full object-cover" type="pdf" />
          ) : (
            previewUrl
              ? <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
              : <ZoomImage src={displayUrl} alt={label} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-300">
            <ImageIcon size={compact ? 20 : 28} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Botones — cada uno con su propio ref */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="btn-secondary text-xs py-1.5 flex-1 justify-center"
        >
          <Upload size={12} /> Galería
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="btn-secondary text-xs py-1.5 flex-1 justify-center"
        >
          <Camera size={12} /> Cámara
        </button>
        {displayUrl && (
          <button
            type="button"
            onClick={() => onFileSelected(null)}
            className="btn-ghost text-red-500 hover:bg-red-50 text-xs py-1.5 px-2.5"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
