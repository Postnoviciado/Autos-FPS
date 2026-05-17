import { useEffect, useRef, useState } from 'react'
import { RotateCw, ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  src: string
  alt?: string
}

export default function ImageZoomViewer({ src, alt = 'Imagen' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    setScale(1)
    setRotation(0)
  }, [src])

  const updateScale = (nextScale: number) => {
    setScale(Math.min(5, Math.max(0.5, nextScale)))
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.1 : -0.1
    const container = containerRef.current
    if (!container) {
      updateScale(scale + delta)
      return
    }

    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const nextScale = Math.min(5, Math.max(0.5, scale + delta))
    const ratio = nextScale / scale

    container.scrollLeft = (container.scrollLeft + pointerX) * ratio - pointerX
    container.scrollTop = (container.scrollTop + pointerY) * ratio - pointerY
    updateScale(nextScale)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    setIsDragging(true)
    container.setPointerCapture(event.pointerId)
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const container = containerRef.current
    if (!container) return

    event.preventDefault()
    const dx = event.clientX - dragStart.current.x
    const dy = event.clientY - dragStart.current.y
    container.scrollLeft = dragStart.current.scrollLeft - dx
    container.scrollTop = dragStart.current.scrollTop - dy
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    setIsDragging(false)
    container.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-slate-500 text-sm">Arrastra la imagen o usa la rueda para acercar/alejar</div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => updateScale(scale - 0.25)} className="btn-ghost px-3 py-2" disabled={scale <= 0.5}>
            <ZoomOut size={16} />
          </button>
          <button type="button" onClick={() => { setScale(1); setRotation(0) }} className="btn-ghost px-3 py-2">
            {Math.round(scale * 100)}%
          </button>
          <button type="button" onClick={() => updateScale(scale + 0.25)} className="btn-ghost px-3 py-2" disabled={scale >= 5}>
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} className="btn-ghost px-3 py-2">
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="rounded-3xl border border-cream-200 overflow-auto bg-cream-100 min-h-[480px] max-h-[80vh] p-4"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="inline-block">
          <img
            src={src}
            alt={alt}
            className="block select-none"
            style={{
              width: `${scale * 100}%`,
              maxWidth: 'none',
              height: 'auto',
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease',
              transformOrigin: 'center center',
              userSelect: 'none',
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
