import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { LoginScreen } from '@/components/cashier/screens/Login'
import { CashierApp } from '@/components/cashier/CashierApp'
import { pingServer } from '@/services/api'
import { T } from '@/lib/theme'

// pos-monitor kassir UI'sini ko'rsatadi. Ma'lumot local-server (aridaipos_server,
// localhost:4561 yoki Settings'dagi LAN IP) orqali. Server bilan aloqa bo'lmasa —
// ServerGate "ulanish xatosi" sahifasini ko'rsatadi (smena/login EMAS).

const fullCenter = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: T.bg,
  fontFamily: T.font,
}

function Loading({ text }) {
  return (
    <div style={{ ...fullCenter, color: T.textMuted, fontSize: 18 }}>{text}</div>
  )
}

// ── Ulanish xatosi sahifasi (sodda — kassir uchun, texnik tafsilotsiz) ──
function ConnectionError({ onRetry }) {
  return (
    <div style={{ ...fullCenter, flexDirection: 'column', gap: 26, padding: 24, textAlign: 'center' }}>
      <style>{`@keyframes ariPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}`}</style>
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: T.cancelledBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: T.cancelled,
            animation: 'ariPulse 1.3s ease-in-out infinite',
          }}
        />
      </div>

      <div style={{ fontSize: 34, fontWeight: 900, color: T.text, letterSpacing: -0.5 }}>
        Нет связи с сервером
      </div>

      <div style={{ fontSize: 19, color: T.textMuted, maxWidth: 440, lineHeight: 1.5 }}>
        Идёт переподключение… Подождите немного.
        <br />
        Если это не исчезнет — обратитесь к администратору.
      </div>

      <button
        onClick={onRetry}
        style={{
          marginTop: 6,
          height: 58,
          padding: '0 40px',
          background: T.cta,
          color: '#fff',
          border: 'none',
          fontFamily: T.font,
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 0.4,
          cursor: 'pointer',
        }}
      >
        Повторить
      </button>
    </div>
  )
}

// ── Ulanish-darvozasi: server bilan aloqa bo'lmasa app ochilmaydi ──
function ServerGate({ children }) {
  const [status, setStatus] = useState('checking') // checking | online | offline
  const failRef = useRef(0)

  const check = useCallback(async () => {
    const ok = await pingServer()
    if (ok) {
      failRef.current = 0
      setStatus('online')
    } else {
      failRef.current += 1
      // Online holatda bitta xato (blink) sababli darhol offline qilmaymiz —
      // ketma-ket 2 marta xato bo'lsa offline. Boshlanishida darhol offline.
      setStatus((prev) => (prev === 'online' && failRef.current < 2 ? 'online' : 'offline'))
    }
  }, [])

  useEffect(() => {
    check()
    const t = setInterval(check, 4000)
    return () => clearInterval(t)
  }, [check])

  if (status === 'checking') return <Loading text="Подключение к серверу…" />
  if (status === 'offline') return <ConnectionError onRetry={check} />
  return children
}

function Root() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Loading text="Загрузка…" />
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'auto',
        background: T.bg,
      }}
    >
      {isAuthenticated ? <CashierApp /> : <LoginScreen />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ServerGate>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ServerGate>
  </React.StrictMode>
)
