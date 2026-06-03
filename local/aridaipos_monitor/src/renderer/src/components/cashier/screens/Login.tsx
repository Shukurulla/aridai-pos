'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { T, NavIcon } from '@/lib/theme';
import { CTA } from '../shell';
import logoUrl from '@/assets/aridai-logo.png';

const formatPhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('7')) digits = digits.slice(1);
  if (digits.startsWith('8')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let formatted = '+7';
  if (digits.length > 0) formatted += ' ' + digits.slice(0, 3);
  if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
  if (digits.length > 6) formatted += ' ' + digits.slice(6, 8);
  if (digits.length > 8) formatted += ' ' + digits.slice(8, 10);
  return formatted;
};
const unformatPhone = (value: string) => '+' + value.replace(/\D/g, '');
const isPhoneComplete = (value: string) => value.replace(/\D/g, '').length === 11;

export function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+7');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState<'phone' | 'password'>('phone');

  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  const setPhoneSafe = (raw: string) => {
    const f = formatPhone(raw);
    if (f.length <= 17) setPhone(f);
  };

  const handleKey = (k: string) => {
    if (focused === 'phone') {
      if (k === 'C') setPhone('+7');
      else if (k === '⌫') setPhoneSafe(phone.slice(0, -1));
      else setPhoneSafe(phone + k);
    } else {
      if (k === 'C') setPassword('');
      else if (k === '⌫') setPassword((p) => p.slice(0, -1));
      else setPassword((p) => p + k);
    }
  };

  const submit = async () => {
    if (!isPhoneComplete(phone) || !password || isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      await login(unformatPhone(phone), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: T.bg, display: 'flex', overflow: 'hidden' }}>
      {/* Brand */}
      <div
        style={{
          flex: 1,
          background: T.borderStrong,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Aridai" style={{ width: 120, height: 120, display: 'block' }} />
        </div>
        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05, letterSpacing: -0.5 }}>AridaiPOS</div>
        <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)', marginTop: 24, maxWidth: 440, lineHeight: 1.5 }}>
          Войдите для начала смены. Используйте телефон и пароль, выданный администратором.
        </div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 40,
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 0.5,
          }}
        >
          Касса ресторана
        </div>
      </div>

      {/* Form */}
      <div
        style={{
          width: 560,
          background: T.surface,
          display: 'flex',
          flexDirection: 'column',
          padding: 48,
          gap: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 900 }}>Вход в систему</div>
        <div style={{ fontSize: 15, color: T.textMuted, marginBottom: 4 }}>
          Введите номер телефона и пароль
        </div>

        {error && (
          <div
            style={{
              background: T.cancelledBg,
              color: T.cancelled,
              padding: '12px 16px',
              fontSize: 15,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <label
          style={{ fontSize: 14, color: T.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          Телефон
        </label>
        <input
          value={phone}
          onChange={(e) => setPhoneSafe(e.target.value)}
          onFocus={() => setFocused('phone')}
          placeholder="+7 XXX XXX XX XX"
          inputMode="numeric"
          style={{
            height: 60,
            padding: '0 18px',
            background: focused === 'phone' ? T.surface : T.panel,
            border: `2px solid ${focused === 'phone' ? T.cta : T.borderStrong}`,
            fontSize: 24,
            fontFamily: T.font,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        />

        <label
          style={{
            fontSize: 14,
            color: T.textMuted,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 4,
          }}
        >
          Пароль
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused('password')}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Введите пароль"
            style={{
              width: '100%',
              height: 60,
              padding: '0 56px 0 18px',
              background: focused === 'password' ? T.surface : T.panel,
              border: `2px solid ${focused === 'password' ? T.cta : T.borderStrong}`,
              fontSize: 26,
              fontFamily: T.font,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: showPassword ? 1 : 6,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.textMuted,
            }}
          >
            <NavIcon kind={showPassword ? 'x' : 'user'} color={T.textMuted} size={22} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
          {numpad.map((k) => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              style={{
                height: 58,
                background: k === 'C' || k === '⌫' ? T.panelStrong : T.surface,
                border: `2px solid ${T.borderStrong}`,
                fontFamily: T.font,
                fontSize: 26,
                fontWeight: 800,
                color: k === 'C' ? T.cancelled : T.text,
                cursor: 'pointer',
              }}
            >
              {k}
            </button>
          ))}
        </div>

        <CTA
          height={68}
          fontSize={22}
          onClick={submit}
          disabled={isLoading || !isPhoneComplete(phone) || !password}
        >
          {isLoading ? 'ВХОД…' : 'ВОЙТИ →'}
        </CTA>
      </div>
    </div>
  );
}
