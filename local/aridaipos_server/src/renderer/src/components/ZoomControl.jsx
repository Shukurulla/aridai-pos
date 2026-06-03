import { useEffect, useState } from 'react'

// Ekran zoom'i — ELECTRON-NATIVE (main process: webContents.setZoomFactor).
// CSS zoom EMAS — shuning uchun sahifa qayta joylanadi, chetda bo'sh joy
// QOLMAYDI. Qiymat saqlanadi (main), qayta ochilganda tiklanadi.
const MIN = 0.5
const MAX = 2
const STEP = 0.1
const clamp = (z) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))

function bridge() {
  if (typeof window === 'undefined') return null
  return (window.pos && window.pos.zoom) || (window.aridai && window.aridai.zoom) || null
}

export default function ZoomControl() {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const z = bridge()
    if (!z) return
    Promise.resolve(z.get())
      .then((f) => setZoom(clamp(Number(f) || 1)))
      .catch(() => {})
  }, [])

  const apply = (next) => {
    const z = clamp(next)
    setZoom(z)
    const b = bridge()
    if (b) Promise.resolve(b.set(z)).catch(() => {})
  }

  const btn = {
    width: 44,
    height: 44,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 24,
    fontWeight: 900,
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  if (!bridge()) return null // faqat Electron'da

  return (
    <div
      style={{
        position: 'fixed',
        left: 10,
        bottom: 10,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(10,10,10,0.82)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 6,
        userSelect: 'none'
      }}
    >
      <button style={btn} onClick={() => apply(zoom - STEP)} title="Уменьшить">
        −
      </button>
      <button
        style={{ ...btn, width: 58, fontSize: 14, fontWeight: 800 }}
        onClick={() => apply(1)}
        title="Сбросить (100%)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button style={btn} onClick={() => apply(zoom + STEP)} title="Увеличить">
        +
      </button>
    </div>
  )
}
