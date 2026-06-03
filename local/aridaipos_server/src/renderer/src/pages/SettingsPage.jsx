import { useEffect, useState, useCallback } from 'react'
import { T } from '../lib/theme'

export default function SettingsPage() {
  const [ver, setVer] = useState('')
  const [packaged, setPackaged] = useState(true)
  const [st, setSt] = useState({ state: 'idle' })
  const [releases, setReleases] = useState([])
  const [relErr, setRelErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(1)
  // Lokal bazani tozalash holati
  const [purgeBusy, setPurgeBusy] = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)

  const zoomBridge = () =>
    (typeof window !== 'undefined' &&
      ((window.aridai && window.aridai.zoom) || (window.pos && window.pos.zoom))) ||
    null
  useEffect(() => {
    const z = zoomBridge()
    if (z) z.get().then((f) => setZoom(Math.round((Number(f) || 1) * 100) / 100)).catch(() => {})
  }, [])
  const applyZoom = (val) => {
    const v = Math.min(2, Math.max(0.5, Math.round(val * 100) / 100))
    setZoom(v)
    const z = zoomBridge()
    if (z) z.set(v).catch(() => {})
  }

  useEffect(() => {
    window.aridai.updates.current().then((r) => {
      setVer(r?.version || '')
      setPackaged(r?.packaged !== false)
    })
    const off = window.aridai.updates.onEvent((p) => setSt(p))
    return off
  }, [])

  const loadReleases = useCallback(async () => {
    setRelErr('')
    const r = await window.aridai.updates.releases()
    if (r && r.success) setReleases(r.data || [])
    else setRelErr((r && r.error) || 'Не удалось получить список версий')
  }, [])

  useEffect(() => {
    loadReleases()
  }, [loadReleases])

  const check = async () => {
    setBusy(true)
    const r = await window.aridai.updates.check()
    setBusy(false)
    if (r && r.success === false) setSt({ state: 'error', error: r.error })
  }
  const download = () => window.aridai.updates.download()
  const install = () => window.aridai.updates.install()

  // Lokal bazadagi eski/begona orderlarni tozalash. Boshqa restoran +
  // joriy restoran ichida boshqa smena synced orderlari o'chadi.
  // Hali jo'natilmagan (sync_status='local') TEGILMAYDI.
  const purgeStaleOrders = async () => {
    const ok = window.confirm(
      'Лок. базадан eski smena va boshqa restoran orderlari o\'chiriladi.\n\nHali jo\'natilmagan (offline) zakazlar TEGILMAYDI. Davom etamizmi?'
    )
    if (!ok) return
    setPurgeBusy(true)
    setPurgeResult(null)
    try {
      const r = await window.aridai.orders.purgeStale()
      setPurgeResult(r)
    } catch (e) {
      setPurgeResult({ success: false, error: e?.message || 'Ошибка' })
    } finally {
      setPurgeBusy(false)
    }
  }

  const stateLabel = () => {
    switch (st.state) {
      case 'checking':
        return 'Проверка обновлений…'
      case 'available':
        return `Доступна новая версия ${st.version}`
      case 'downloading':
        return `Загрузка… ${st.percent || 0}%`
      case 'downloaded':
        return `Версия ${st.version} загружена — можно установить`
      case 'latest':
        return 'Установлена последняя версия'
      case 'error': {
        const e = String(st.error || '')
        if (/404|not found|releases\.atom|authentication token/i.test(e))
          return 'Авто-обновление недоступно: на GitHub нет опубликованных релизов (или репозиторий приватный). Обновите вручную, установив новую версию .exe.'
        return 'Ошибка обновления: ' + (e.length > 140 ? e.slice(0, 140) + '…' : e)
      }
      default:
        return ''
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Настройки</h1>
      <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 24px' }}>Обновления приложения</p>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Масштаб экрана</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => applyZoom(zoom - 0.1)} style={btn(T.surface, T.text, true)}>
            − Меньше
          </button>
          <div style={{ minWidth: 70, textAlign: 'center', fontSize: 18, fontWeight: 900 }}>
            {Math.round(zoom * 100)}%
          </div>
          <button onClick={() => applyZoom(zoom + 0.1)} style={btn(T.surface, T.text, true)}>
            + Больше
          </button>
          <button onClick={() => applyZoom(1)} style={btn(T.cta, '#fff')}>
            Сброс 100%
          </button>
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Очистка локальной базы</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
          Из локальной SQLite удаляются заказы <b>другого ресторана</b> и заказы <b>прошлых смен</b> текущего ресторана
          (только уже синхронизированные с VPS). Офлайн-заказы, ожидающие отправки на сервер, <b>не трогаются</b>.
          Полезно, если в кассе видны «фантомные» заказы со старых смен.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={purgeStaleOrders} disabled={purgeBusy} style={btn(T.cancelled || '#c0392b', '#fff')}>
            {purgeBusy ? 'Очистка…' : '🧹 Очистить старые заказы'}
          </button>
          {purgeResult && purgeResult.success && (
            <div style={{ fontSize: 13, color: T.text }}>
              ✓ Удалено: <b>{purgeResult.deleted?.total || 0}</b>
              {' '}(другой ресторан: {purgeResult.deleted?.otherRestaurant || 0},
              {' '}другие смены: {purgeResult.deleted?.otherShift || 0}).
              {' '}Осталось в текущем ресторане: <b>{purgeResult.remaining || 0}</b>.
            </div>
          )}
          {purgeResult && !purgeResult.success && (
            <div style={{ fontSize: 13, color: T.cancelled }}>
              ✗ Ошибка: {purgeResult.error}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Обновления</div>
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 14 }}>
          Текущая версия: <b style={{ color: T.text }}>{ver || '—'}</b>
          {!packaged && ' · (dev — авто-обновление только в установленном .exe)'}
        </div>
        {stateLabel() && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 14,
              background: st.state === 'error' ? T.cancelledBg : T.panelStrong,
              color: st.state === 'error' ? T.cancelled : T.text,
              fontWeight: 700,
              fontSize: 14
            }}
          >
            {stateLabel()}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={check} disabled={busy} style={btn(T.cta, '#fff')}>
            {busy ? 'Проверка…' : 'Проверить обновления'}
          </button>
          {st.state === 'available' && (
            <button onClick={download} style={btn(T.surface, T.text, true)}>
              Скачать
            </button>
          )}
          {st.state === 'downloaded' && (
            <button onClick={install} style={btn(T.cta, '#fff')}>
              Установить и перезапустить
            </button>
          )}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Версии (откат)</div>
          <button onClick={loadReleases} style={btn(T.surface, T.text, true)}>
            Обновить список
          </button>
        </div>
        {relErr && <div style={{ fontSize: 13, color: T.cancelled, marginBottom: 10 }}>{relErr}</div>}
        {releases.length === 0 && !relErr && (
          <div style={{ color: T.textMuted, fontSize: 14, padding: 16, textAlign: 'center' }}>
            Релизы не найдены. Версии появятся после публикации на GitHub Releases.
          </div>
        )}
        {releases.map((r) => (
          <div
            key={r.tag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 4px',
              borderBottom: `1px solid ${T.borderSoft}`
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {r.name} {r.prerelease ? '(beta)' : ''}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {r.tag} · {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString('ru-RU') : ''}
              </div>
            </div>
            {(r.exe || []).map((a) => (
              <button key={a.url} onClick={() => window.aridai.updates.open(a.url)} style={btn(T.cta, '#fff')}>
                Скачать {a.name.length > 22 ? '.exe' : a.name}
              </button>
            ))}
            <button onClick={() => window.aridai.updates.open(r.url)} style={btn(T.surface, T.text, true)}>
              Открыть
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function btn(bg, color, outline) {
  return {
    height: 44,
    padding: '0 18px',
    background: bg,
    color,
    border: outline ? `2px solid ${T.borderStrong}` : 'none',
    fontFamily: T.font,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer'
  }
}
