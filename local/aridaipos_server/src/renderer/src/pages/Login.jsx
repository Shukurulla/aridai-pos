import { useState } from 'react'
import { T } from '../lib/theme'
import aridaiLogo from '../assets/aridai-logo.png'

export default function Login({ onSuccess }) {
  const [phone, setPhone] = useState('+7')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeField, setActiveField] = useState('phone')

  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    if (!digits) return ''
    if (!digits.startsWith('7')) return '+7'
    const d = digits.slice(1)
    let out = '+7'
    if (d.length > 0) out += ' ' + d.slice(0, 3)
    if (d.length > 3) out += ' ' + d.slice(3, 6)
    if (d.length > 6) out += ' ' + d.slice(6, 8)
    if (d.length > 8) out += ' ' + d.slice(8, 10)
    return out
  }

  const pressKey = (k) => {
    if (loading) return
    if (activeField === 'password') {
      setPassword((prev) => (k === 'clear' ? '' : k === 'back' ? prev.slice(0, -1) : prev + k))
      return
    }
    setPhone((prev) => {
      const digits = prev.replace(/\D/g, '')
      if (k === 'clear') return '+7'
      if (k === 'back') return formatPhone(digits.slice(0, -1)) || '+7'
      return formatPhone(digits + k)
    })
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const result = await window.aridai.auth.login(phone, password)
      if (result.success) {
        onSuccess(result.data)
      } else {
        setError(result.error || 'Ошибка входа')
      }
    } catch (err) {
      setError(err?.message || 'Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.bg,
        fontFamily: T.font,
        overflowY: 'auto',
        padding: '16px 0'
      }}
    >
      <div
        style={{
          width: 460,
          background: T.surface,
          border: `1px solid ${T.border}`,
          padding: '44px 40px 36px',
          boxShadow: '0 4px 24px rgba(31,28,23,0.06)'
        }}
      >
        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img src={aridaiLogo} alt="Aridai" style={{ width: 56, height: 56 }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05 }}>AridaiPOS</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>Local Server · Филиал</div>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Вход администратора</h2>
        <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 22px' }}>
          Введите телефон и пароль администратора филиала
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Телефон
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="+7 700 000 00 00"
            disabled={loading}
            autoFocus
            style={{
              width: '100%',
              height: 52,
              padding: '0 14px',
              fontSize: 17,
              fontFamily: T.font,
              fontVariantNumeric: 'tabular-nums',
              background: T.panel,
              border: `2px solid ${T.border}`,
              outline: 'none',
              marginBottom: 16,
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = T.borderStrong
              setActiveField('phone')
            }}
            onBlur={(e) => (e.target.style.borderColor = T.border)}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Пароль
          </label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              disabled={loading}
              style={{
                width: '100%',
                height: 52,
                padding: '0 56px 0 14px',
                fontSize: 17,
                fontFamily: T.font,
                background: T.panel,
                border: `2px solid ${T.border}`,
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = T.borderStrong
                setActiveField('password')
              }}
              onBlur={(e) => (e.target.style.borderColor = T.border)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                height: 36,
                padding: '0 12px',
                background: 'transparent',
                border: 'none',
                color: T.textMuted,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {showPassword ? 'Скрыть' : 'Показать'}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8 }}>
              {activeField === 'phone' ? 'Ввод: Телефон' : 'Ввод: Пароль'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((k) => {
                const isAux = k === 'clear' || k === 'back'
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    disabled={loading}
                    style={{
                      height: 48,
                      background: isAux ? T.panelStrong : T.panel,
                      color: k === 'clear' ? T.cancelled : T.text,
                      border: `2px solid ${T.border}`,
                      fontFamily: T.font,
                      fontSize: 20,
                      fontWeight: 800,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: T.cancelledBg,
                color: T.cancelled,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || phone.replace(/\D/g, '').length !== 11}
            style={{
              width: '100%',
              height: 60,
              marginTop: 18,
              background: loading ? T.panelStrong : T.cta,
              color: '#fff',
              border: 'none',
              fontFamily: T.font,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 0.5,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Вход…' : 'ВОЙТИ'}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 12, color: T.textDim, textAlign: 'center' }}>
          v0.1.0 · только для администратора филиала
        </div>
      </div>
    </div>
  )
}
