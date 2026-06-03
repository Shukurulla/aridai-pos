import { useEffect, useState } from 'react'
import { T } from './lib/theme'
import Login from './pages/Login'
import Shell from './pages/Shell'

export default function App() {
  const [auth, setAuth] = useState(undefined) // undefined = loading, null = guest, obj = logged
  const [bridgeError, setBridgeError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let tries = 0

    const init = () => {
      // Preload bridge may not be ready on the very first paint — wait briefly.
      if (typeof window === 'undefined' || !window.aridai?.auth?.current) {
        tries += 1
        if (tries > 30) {
          if (!cancelled) setBridgeError(true)
          return
        }
        setTimeout(init, 100)
        return
      }
      window.aridai.auth
        .current()
        .then((a) => {
          if (!cancelled) setAuth(a || null)
        })
        .catch(() => {
          if (!cancelled) setAuth(null)
        })
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  if (bridgeError) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: T.bg,
          color: T.text,
          fontFamily: T.font,
          padding: 40,
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900 }}>Ошибка запуска</div>
        <div style={{ fontSize: 16, color: T.textMuted, maxWidth: 520, lineHeight: 1.5 }}>
          Не удалось загрузить системный мост приложения. Перезапустите AridaiPOS Local Server.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            height: 56,
            padding: '0 28px',
            background: T.cta,
            color: '#fff',
            border: 'none',
            fontFamily: T.font,
            fontSize: 18,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Перезапустить
        </button>
      </div>
    )
  }

  if (auth === undefined) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          color: T.textMuted,
          fontFamily: T.font
        }}
      >
        Загрузка…
      </div>
    )
  }

  if (!auth) {
    return <Login onSuccess={setAuth} />
  }

  return <Shell auth={auth} onLogout={() => setAuth(null)} />
}
