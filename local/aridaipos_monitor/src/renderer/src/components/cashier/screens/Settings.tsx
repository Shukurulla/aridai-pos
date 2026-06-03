'use client';

import { useState, useEffect } from 'react';
import { PrinterAPI } from '@/services/printer';
import { api } from '@/services/api';
import { T, NavIcon } from '@/lib/theme';
import { SubHeader, SectionTitle, Btn, ToggleRow, Row } from '../shell';
import { ScreenCtx } from './types';

export function SettingsScreen({ ctx }: { ctx: ScreenCtx }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  // ─── Local Server URL (LAN — boshqa pos-monitor'lar ulanishi uchun) ───
  // Foydalanuvchi qo'lda kiritadi (mas. "http://192.168.1.50:4561"). Bo'sh —
  // o'zining localhost:4561 (aridaipos_server) ishlatiladi (default). Saqlash + reload.
  const DEFAULT_HUB = 'http://localhost:4561';
  const [hubUrl, setHubUrl] = useState<string>('');
  const [hubSaving, setHubSaving] = useState(false);
  const [hubTesting, setHubTesting] = useState(false);
  const [hubReachable, setHubReachable] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('hub-url') || '';
      setHubUrl(stored);
    } catch {
      /* ignore */
    }
  }, []);

  // ─── Услуга% / Скидка% (restoran sozlamasi, backendda saqlanadi) ───
  const [svcPct, setSvcPct] = useState('10');
  const [svcEnabled, setSvcEnabled] = useState(false); // услуга on/off
  const [chgLoaded, setChgLoaded] = useState(false);
  const [chgSaving, setChgSaving] = useState(false);
  const [chgMsg, setChgMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getRestaurantSettings()
      .then((s) => {
        if (!alive) return;
        const sv = s.serviceChargePercent ?? 0;
        setSvcPct(String(sv || 10)); // 0 bo'lsa input uchun mantiqiy boshlang'ich
        setSvcEnabled(s.serviceChargeEnabled === true);
        setChgLoaded(true);
      })
      .catch(() => alive && setChgLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // Toggle yoki input o'zgarsa — DARHOL backendga saqlaydi (alohida tugma yo'q).
  // over: toggle bosilganda yangi holatni uzatadi (state hali yangilanmagan bo'lishi mumkin).
  const saveCharges = async (over: { svcEnabled?: boolean; svcPct?: string } = {}) => {
    const svcOn = over.svcEnabled ?? svcEnabled;
    setChgSaving(true);
    setChgMsg(null);
    try {
      const sv = Math.max(0, Math.min(100, Number(over.svcPct ?? svcPct) || 0));
      const r = await api.updateRestaurantSettings({
        serviceChargeEnabled: svcOn,
        serviceChargePercent: sv,
      });
      setSvcEnabled(r.serviceChargeEnabled === true);
      if ((r.serviceChargePercent ?? 0) > 0) setSvcPct(String(r.serviceChargePercent));
      setChgMsg('Сохранено ✓');
      setTimeout(() => setChgMsg((m) => (m === 'Сохранено ✓' ? null : m)), 1500);
    } catch (e) {
      try {
        const s = await api.getRestaurantSettings();
        setSvcEnabled(s.serviceChargeEnabled === true);
      } catch { /* ignore */ }
      setChgMsg(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setChgSaving(false);
    }
  };

  const normalizedHub = (value: string) => value.trim().replace(/\/+$/, '');

  const testHub = async (url: string) => {
    setHubTesting(true);
    setHubReachable(null);
    try {
      const base = normalizedHub(url) || DEFAULT_HUB;
      // Local-server hub uchun `/health` endpoint mavjud (api-server.js 119:
      // `app.get('/health', ...)`) — offline'da ham ishlaydi, VPS'ga
      // forwarding qilinmaydi. Bu eng aniq ishonchli health check.
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const res = await fetch(`${base}/health`, { signal: ctl.signal });
      clearTimeout(t);
      setHubReachable(res.ok);
      return res.ok;
    } catch {
      setHubReachable(false);
      return false;
    } finally {
      setHubTesting(false);
    }
  };

  const saveHub = async () => {
    setHubSaving(true);
    try {
      const value = normalizedHub(hubUrl);
      if (value) {
        // Format validatsiya — http:// yoki https:// bilan boshlanishi kerak.
        if (!/^https?:\/\//i.test(value)) {
          alert("URL 'http://' yoki 'https://' bilan boshlanishi kerak");
          return;
        }
        window.localStorage.setItem('hub-url', value);
      } else {
        window.localStorage.removeItem('hub-url');
      }
      if (confirm('Hub URL saqlandi. Ilovani qayta yuklash kerak.\nHozir qayta yuklaymizmi?')) {
        window.location.reload();
      }
    } finally {
      setHubSaving(false);
    }
  };

  const resetHub = () => {
    setHubUrl('');
    setHubReachable(null);
  };

  const check = async () => {
    setChecking(true);
    try {
      setOnline(await PrinterAPI.checkConnection());
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  const testPrint = async () => {
    setTesting(true);
    try {
      const res = await PrinterAPI.printTest();
      if (!res.success) alert('Ошибка тестовой печати: ' + (res.error || ''));
      else alert('Тестовая печать отправлена');
    } catch {
      alert('Не удалось подключиться к Local Server');
    } finally {
      setTesting(false);
    }
  };

  // ─── Обновления приложения (Electron — window.pos.updates) ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const U = (typeof window !== 'undefined' ? (window as any).pos?.updates : null) || null;
  const [ver, setVer] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ust, setUst] = useState<any>({ state: 'idle' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rels, setRels] = useState<any[]>([]);
  const loadRels = () => {
    if (!U?.releases) return;
    U.releases()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((r: any) => {
        if (r && r.success) setRels(r.data || []);
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (!U) return;
    U.current().then((r: { version?: string }) => setVer(r?.version || '')).catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const off = U.onEvent((p: any) => setUst(p || { state: 'idle' }));
    // Sozlama ochilganda DARHOL tekshiramiz (avval faqat ishga tushganda
    // 1 marta tekshirilardi → Sozlamani ochganda holat 'idle' bo'lib
    // "Скачать" chiqmasdi). + GitHub relizlar ro'yxatini yuklaymiz —
    // to'g'ridan-to'g'ri .exe yuklab olish uchun (ishonchli yo'l).
    U.check?.().catch(() => {});
    loadRels();
    return off;
  }, [U]);
  const uLabel = () => {
    const s = ust.state;
    if (s === 'checking') return 'Проверка обновлений…';
    if (s === 'available') return `Доступна версия ${ust.version || ''}`;
    if (s === 'downloading') return `Загрузка ${ust.percent || 0}%`;
    if (s === 'downloaded') return `Версия ${ust.version || ''} загружена`;
    if (s === 'latest') return 'Установлена последняя версия';
    if (s === 'error') return 'Ошибка: ' + String(ust.error || '').slice(0, 80);
    return '';
  };

  // ─── Масштаб экрана (Electron — window.pos.zoom). Avval suzuvchi
  //     overlay edi (ekran ustida, noqulay) → endi shu yerda.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Z = (typeof window !== 'undefined' ? (window as any).pos?.zoom : null) || null;
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!Z) return;
    Z.get().then((f: number) => setZoom(Math.round((Number(f) || 1) * 100) / 100)).catch(() => {});
  }, [Z]);
  const applyZoom = (z: number) => {
    const v = Math.min(2, Math.max(0.5, Math.round(z * 100) / 100));
    setZoom(v);
    Z?.set(v).catch(() => {});
  };

  return (
    <div style={{ flex: 1, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SubHeader title="Настройки" onBack={() => ctx.go('orders')} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 22,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          <SectionTitle>Local Server</SectionTitle>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
            URL local-server'ga (port 4561). Bo'sh qoldirsangiz —
            <b> localhost</b> (shu kompyuter). Boshqa POS'da local-server bo'lsa,
            uning LAN IP'sini kiriting: <code>http://192.168.x.x:4561</code>.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={hubUrl}
              onChange={(e) => {
                setHubUrl(e.target.value);
                setHubReachable(null);
              }}
              placeholder={DEFAULT_HUB}
              style={{
                flex: 1,
                height: 48,
                padding: '0 14px',
                fontSize: 15,
                fontFamily: T.font,
                background: T.panel,
                border: `1px solid ${T.border}`,
                color: T.text,
                outline: 'none',
              }}
            />
            {hubReachable !== null && (
              <div
                style={{
                  padding: '0 12px',
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  background: hubReachable ? T.servedBg : T.cancelledBg,
                  color: hubReachable ? T.served : T.cancelled,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {hubReachable ? 'OK' : 'НЕДОСТУПЕН'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn onClick={() => testHub(hubUrl)} fullWidth height={48} disabled={hubTesting}>
              <NavIcon kind="settings" /> {hubTesting ? 'Проверка…' : 'Проверить'}
            </Btn>
            <Btn onClick={saveHub} fullWidth height={48} disabled={hubSaving}>
              {hubSaving ? 'Сохранение…' : 'Сохранить и перезагрузить'}
            </Btn>
            <Btn onClick={resetHub} fullWidth height={48}>
              По умолчанию (localhost)
            </Btn>
          </div>

          <SectionTitle style={{ marginTop: 12 }}>Услуга</SectionTitle>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
            Услуга (%) добавляется к новым заказам <b>в зале</b> (Собой — без услуги).
            Включите и укажите процент. Скидка задаётся в самом заказе.
          </div>
          <ChargeRow
            label="Услуга"
            enabled={svcEnabled}
            pct={svcPct}
            disabled={!chgLoaded || chgSaving}
            onToggle={(on) => {
              const pct = on && !(Number(svcPct) > 0) ? '10' : svcPct;
              setSvcEnabled(on);
              setSvcPct(pct);
              saveCharges({ svcEnabled: on, svcPct: pct });
            }}
            onPct={setSvcPct}
            onCommit={() => saveCharges()}
          />
          {chgMsg && (
            <div style={{ fontSize: 13, fontWeight: 800, color: chgMsg.includes('✓') ? '#1f7a3a' : T.cancelled }}>
              {chgMsg}
            </div>
          )}

          <SectionTitle style={{ marginTop: 12 }}>Принтер для чеков</SectionTitle>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, color: T.text, lineHeight: 1.5 }}>
              Печать управляется приложением <b>Local Server</b>. Чеки оплаты и
              отчёты автоматически идут на принтер с привязанным логином{' '}
              <b>КАССИРА</b>, кухонные чеки — на принтер повара. Выбирать принтер
              здесь не нужно.
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                background: T.panel,
                border: `2px solid ${online ? T.cta : T.border}`,
              }}
            >
              <NavIcon kind="printer" color={online ? T.cta : T.textMuted} />
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {online === null
                  ? 'Проверка Local Server…'
                  : online
                    ? 'Local Server подключён'
                    : 'Local Server не найден'}
              </div>
            </div>
            {online === false && (
              <div style={{ color: T.textMuted, fontSize: 14 }}>
                Откройте приложение Local Server и настройте принтеры с логинами
                (раздел «Принтеры»).
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={check} fullWidth height={56} disabled={checking}>
              <NavIcon kind="settings" /> {checking ? 'Проверка…' : 'Проверить'}
            </Btn>
            <Btn onClick={testPrint} fullWidth height={56} disabled={testing || online === false}>
              <NavIcon kind="printer" /> {testing ? 'Печать…' : 'Тест печати'}
            </Btn>
          </div>

          {U && (
            <>
              <SectionTitle style={{ marginTop: 12 }}>Обновления</SectionTitle>
              <Row label="Текущая версия" value={ver || '—'} />
              {uLabel() && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: ust.state === 'error' ? T.cancelledBg : T.panelStrong,
                    color: ust.state === 'error' ? T.cancelled : T.text,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {uLabel()}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn onClick={() => U.check()} fullWidth height={52}>
                  <NavIcon kind="settings" /> Проверить обновления
                </Btn>
                {ust.state === 'available' && (
                  <Btn onClick={() => U.download()} fullWidth height={52}>
                    Скачать
                  </Btn>
                )}
                {ust.state === 'downloaded' && (
                  <Btn onClick={() => U.install()} fullWidth height={52}>
                    Установить и перезапустить
                  </Btn>
                )}
              </div>

              {/* To'g'ridan-to'g'ri .exe yuklash (ishonchli yo'l —
                  auto-update holatiga bog'liq emas). */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                }}
              >
                <SectionTitle>Скачать вручную (.exe)</SectionTitle>
                <Btn onClick={loadRels} height={40}>
                  Обновить список
                </Btn>
              </div>
              {rels.length === 0 && (
                <div style={{ fontSize: 13, color: T.textMuted }}>
                  Список релизов недоступен (нет интернета или GitHub). Можно
                  скачать с github.com/Shukurulla/aridai-pos-monitor/releases
                </div>
              )}
              {rels.slice(0, 6).map((r) => (
                <div
                  key={r.tag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      {r.name || r.tag} {r.prerelease ? '(beta)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      {r.tag}
                      {r.publishedAt
                        ? ' · ' + new Date(r.publishedAt).toLocaleDateString('ru-RU')
                        : ''}
                    </div>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(r.exe || []).map((a: any) => (
                    <Btn key={a.url} onClick={() => U.open(a.url)} height={44}>
                      Скачать .exe
                    </Btn>
                  ))}
                  <Btn onClick={() => U.open(r.url)} height={44}>
                    Открыть
                  </Btn>
                </div>
              ))}
            </>
          )}

          {Z && (
            <>
              <SectionTitle style={{ marginTop: 12 }}>Масштаб экрана</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Btn onClick={() => applyZoom(zoom - 0.1)} height={52}>
                  − Меньше
                </Btn>
                <div
                  style={{
                    minWidth: 80,
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </div>
                <Btn onClick={() => applyZoom(zoom + 0.1)} height={52}>
                  + Больше
                </Btn>
                <Btn onClick={() => applyZoom(1)} height={52}>
                  Сброс 100%
                </Btn>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflow: 'hidden',
          }}
        >
          <SectionTitle>Уведомления</SectionTitle>
          <ToggleRow label="Звук нового заказа" storageKey="snd-new-order" defaultOn />
          <ToggleRow label="Звук готовности блюд" storageKey="snd-ready" defaultOn />
          <ToggleRow label="Звук запроса чека от официанта" storageKey="snd-check" defaultOn />
          <ToggleRow label="Автопечать чека при запросе официанта" storageKey="autoprint-check" defaultOn />

          <SectionTitle style={{ marginTop: 12 }}>Профиль</SectionTitle>
          <Row label="Кассир" value={ctx.user?.name || '-'} />
          <Row label="Телефон" value={ctx.user?.phone || '-'} />
          <Row label="Ресторан" value={ctx.restaurant?.name || '-'} />
          <Row label="Филиал" value={ctx.branch?.name || '-'} />

          <button
            onClick={() => {
              if (confirm('Выйти из системы?')) ctx.onLogout();
            }}
            style={{
              marginTop: 18,
              height: 56,
              background: T.cancelledBg,
              color: T.cancelled,
              border: `2px solid ${T.cancelled}`,
              fontFamily: T.font,
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <NavIcon kind="logout" color={T.cancelled} /> Выйти из системы
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle + (yoqilsa) foiz input — Услуга/Скидка uchun yagona oddiy boshqaruv.
// Yoqilsa input chiqadi (oldingi/mantiqiy qiymat bilan), yozilgach avto-saqlanadi.
function ChargeRow({
  label,
  enabled,
  pct,
  onToggle,
  onPct,
  onCommit,
  disabled,
}: {
  label: string;
  enabled: boolean;
  pct: string;
  onToggle: (on: boolean) => void;
  onPct: (v: string) => void;
  onCommit: () => void;
  disabled?: boolean;
}) {
  const ON = '#1f7a3a';
  return (
    <div
      style={{
        border: `1px solid ${enabled ? ON : T.border}`,
        background: T.surface,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: enabled ? 14 : 0,
      }}
    >
      <button
        onClick={() => !disabled && onToggle(!enabled)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: T.font,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{label}</span>
        <span
          style={{
            width: 58,
            height: 32,
            background: enabled ? ON : T.border,
            position: 'relative',
            transition: 'background .15s',
            flexShrink: 0,
            borderRadius: 999,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 29 : 3,
              width: 26,
              height: 26,
              background: '#fff',
              borderRadius: '50%',
              transition: 'left .15s',
            }}
          />
        </span>
      </button>

      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={pct}
            autoFocus
            onChange={(e) => onPct(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{
              width: 130,
              height: 52,
              padding: '0 16px',
              fontSize: 20,
              fontWeight: 800,
              fontFamily: T.font,
              background: T.panel,
              border: `1px solid ${T.border}`,
              color: T.text,
              outline: 'none',
              textAlign: 'center',
            }}
          />
          <span style={{ fontSize: 20, fontWeight: 800, color: T.textMuted }}>%</span>
        </div>
      )}
    </div>
  );
}
