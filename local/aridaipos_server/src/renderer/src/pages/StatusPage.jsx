import { T } from '../lib/theme'

export default function StatusPage({ status, auth, navOnline = true }) {
  const heartbeat = status?.heartbeat || status || {}
  const lastConnected = heartbeat.lastConnectedAt
    ? new Date(heartbeat.lastConnectedAt).toLocaleTimeString('ru-RU')
    : '—'
  const effectiveOnline = navOnline && heartbeat.isOnline

  const cards = [
    {
      label: 'Соединение с VPS',
      value: !navOnline ? 'Нет интернета' : heartbeat.isOnline ? 'Онлайн' : 'Оффлайн',
      color: effectiveOnline ? T.ready : T.cancelled
    },
    {
      label: 'Подключено в',
      value: lastConnected,
      color: T.text
    },
    {
      label: 'Очередь синхр.',
      value: status?.pendingSyncCount || 0,
      color: T.text
    },
    {
      label: 'Попыток реконнекта',
      value: heartbeat.reconnectAttempts || 0,
      color: heartbeat.reconnectAttempts > 0 ? T.preparing : T.text
    }
  ]

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Статус сервера</h1>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 28px' }}>
        Филиал: <strong>{auth.branchName || auth.branchId}</strong> · Restaurant ID: <code>{auth.restaurantId}</code>
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 28
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              padding: '18px 20px'
            }}
          >
            <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, marginBottom: 8 }}>
              {c.label}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: c.color,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {heartbeat.lastError && !heartbeat.isOnline && (
        <div
          style={{
            background: T.cancelledBg,
            color: T.cancelled,
            padding: '14px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: `1px solid ${T.cancelled}`,
            marginBottom: 20
          }}
        >
          Последняя ошибка: {heartbeat.lastError}
        </div>
      )}

      {/* Local DB counts */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Локальная база</h3>
        <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 16px' }}>
          Данные синхронизируются автоматически при изменениях в VPS (real-time через WebSocket).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <CountTile label="Заказы" value={status?.counts?.orders} />
          <CountTile label="Блюда" value={status?.counts?.foods} />
          <CountTile label="Категории" value={status?.counts?.categories} />
          <CountTile label="Столы" value={status?.counts?.tables} />
          <CountTile label="Сотрудники" value={status?.counts?.staff} />
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: T.textMuted }}>
          Последнее обновление:{' '}
          <strong style={{ color: T.text }}>
            {status?.lastFullSyncAt
              ? new Date(status.lastFullSyncAt).toLocaleString('ru-RU')
              : '—'}
          </strong>
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px' }}>Информация</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: T.text }}>
          <li>Соединение с VPS через WebSocket (real-time).</li>
          <li>При отключении сокета VPS моментально помечает филиал как ОФЛАЙН.</li>
          <li>Авто-переподключение при восстановлении сети.</li>
          <li>В офлайн-режиме VPS не принимает заказы от официантов этого филиала.</li>
          <li>Полная синхронизация (меню, столы, заказы) каждые 5 минут.</li>
          <li>Real-time обновления заказов через socket events.</li>
          <li>LAN API запущен на порту <code>4561</code> для POS-мониторов.</li>
        </ul>
      </div>
    </div>
  )
}

function CountTile({ label, value }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: T.panel,
        border: `1px solid ${T.borderSoft}`,
        textAlign: 'center'
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: T.text,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {value ?? 0}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  )
}
