import { useEffect, useState } from 'react'
import { T } from '../lib/theme'
import aridaiLogo from '../assets/aridai-logo.png'
import StatusPage from './StatusPage'
import PrintersPage from './PrintersPage'
import SettingsPage from './SettingsPage'
// Suzuvchi ZoomControl O'CHIRILDI — endi "Настройки" sahifasida (Масштаб).

const NAV = [
  { id: 'status', label: 'Статус' },
  { id: 'printers', label: 'Принтеры' },
  { id: 'settings', label: 'Настройки' }
]

export default function Shell({ auth, onLogout }) {
  const [page, setPage] = useState('status')
  const [status, setStatus] = useState(null)
  // navigator.onLine — instant network detection (faster than socket.io ping)
  const [navOnline, setNavOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Poll status (faster when offline to react to reconnects quickly)
  useEffect(() => {
    let cancelled = false
    async function poll() {
      const s = await window.aridai.status.get()
      if (!cancelled) setStatus(s)
    }
    poll()
    const interval = navOnline ? 5000 : 2000
    const t = setInterval(poll, interval)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [navOnline])

  // OS-level network state change
  useEffect(() => {
    const handler = () => setNavOnline(navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
    }
  }, [])

  const handleLogout = async () => {
    if (!confirm('Выйти из Local Server?')) return
    await window.aridai.auth.logout()
    onLogout()
  }

  // Online faqat: OS network OK + socket connected
  const isOnline = navOnline && status?.isOnline
  const branchOffline = !navOnline || status?.isBranchLockedOffline

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: T.font }}>
      {/* Top header */}
      <header
        style={{
          height: 72,
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0
        }}
      >
        <div
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderRight: `1px solid ${T.border}`
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img src={aridaiLogo} alt="Aridai" style={{ width: 40, height: 40 }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.05 }}>AridaiPOS Local</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
              {auth.restaurantName || 'Ресторан'} · {auth.branchName || 'Филиал'}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 20 }}>
          <StatusBadge online={isOnline} branchOffline={branchOffline} />
          <span style={{ fontSize: 14, color: T.textMuted }}>
            LAN: <strong style={{ color: T.text }}>http://localhost:{status?.localPort || 4561}</strong>
          </span>
          {status?.globalUrl && (
            <span style={{ fontSize: 14, color: T.textMuted }}>
              Сервер:{' '}
              <strong style={{ color: isOnline ? T.text : T.cancelled }}>
                {status.globalUrl.replace(/^https?:\/\//, '')}
              </strong>
              {!isOnline && status?.heartbeat?.lastError && (
                <span style={{ color: T.cancelled }}> · {status.heartbeat.lastError}</span>
              )}
            </span>
          )}
          {status && (
            <span style={{ fontSize: 14, color: T.textMuted }}>
              Очередь синхр.: <strong style={{ color: T.text }}>{status.pendingSyncCount || 0}</strong>
            </span>
          )}
        </div>

        {/* User + logout */}
        <div
          style={{
            padding: '0 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            borderLeft: `1px solid ${T.border}`
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>
              {auth.staff?.firstName} {auth.staff?.lastName}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {auth.staff?.role === 'owner' ? 'Владелец' : 'Админ филиала'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '11px 18px',
              background: T.surface,
              border: `2px solid ${T.borderStrong}`,
              fontSize: 14,
              fontWeight: 800,
              fontFamily: T.font,
              cursor: 'pointer'
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <nav
          style={{
            width: 220,
            background: T.surface,
            borderRight: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}
        >
          {NAV.map((it) => {
            const active = it.id === page
            return (
              <button
                key={it.id}
                onClick={() => setPage(it.id)}
                style={{
                  height: 60,
                  background: active ? T.cta : 'transparent',
                  color: active ? '#fff' : T.text,
                  border: 'none',
                  borderBottom: `1px solid ${T.borderSoft}`,
                  fontFamily: T.font,
                  fontSize: 15,
                  fontWeight: 700,
                  textAlign: 'left',
                  padding: '0 24px',
                  cursor: 'pointer'
                }}
              >
                {it.label}
              </button>
            )
          })}
        </nav>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', background: T.bg, padding: 28 }}>
          {page === 'status' && <StatusPage status={status} auth={auth} navOnline={navOnline} />}
          {page === 'printers' && <PrintersPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}

function StatusBadge({ online, branchOffline }) {
  let bg, color, label, dot
  if (branchOffline) {
    bg = T.cancelledBg
    color = T.cancelled
    label = 'Филиал ОФЛАЙН'
    dot = T.cancelled
  } else if (online) {
    bg = T.readyBg
    color = T.ready
    label = 'Онлайн'
    dot = T.ready
  } else {
    bg = T.pendingBg
    color = T.pending
    label = 'Соединение…'
    dot = T.pending
  }
  return (
    <div
      style={{
        background: bg,
        color,
        padding: '8px 14px',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: 0.3,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <span style={{ width: 10, height: 10, background: dot, borderRadius: 999 }} />
      {label}
    </div>
  )
}
