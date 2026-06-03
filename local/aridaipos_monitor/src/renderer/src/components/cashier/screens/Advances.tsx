'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Advance, Waiter } from '@/types';
import { T, NavIcon, fmt } from '@/lib/theme';
import { SubHeader, SectionTitle, MiniStat, CTA, Btn, FormField, Pager } from '../shell';
import { ScreenCtx } from './types';

export function AdvancesScreen({ ctx }: { ctx: ScreenCtx }) {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [availableCash, setAvailableCash] = useState(0);
  const [availableClick, setAvailableClick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    waiterId: '',
    amount: '',
    description: '',
    paymentType: 'cash' as 'cash' | 'click',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const shiftId = ctx.activeShift?._id || null;
      const [adv, wts, bal] = await Promise.all([
        shiftId ? api.getAdvancesByShift(shiftId) : Promise.resolve([]),
        api.getWaiters(),
        api.getAvailableBalances(),
      ]);
      setAdvances(adv);
      setWaiters(wts);
      setAvailableCash(bal.availableCash);
      setAvailableClick(bal.availableClick);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ctx.activeShift?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmtInput = (v: string) => v.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const parseAmount = (v: string) => parseFloat(v.replace(/\s/g, '')) || 0;

  const submit = async () => {
    if (!form.waiterId || !form.amount) {
      alert('Выберите официанта и введите сумму');
      return;
    }
    const amount = parseAmount(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    if (form.paymentType === 'click' && amount > availableClick) {
      alert(`Недостаточно средств на переводе!\nДоступно: ${fmt(availableClick)}`);
      return;
    }
    if (form.paymentType === 'cash' && amount > availableCash) {
      alert(`Недостаточно наличных!\nДоступно: ${fmt(availableCash)}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.createAdvance({
        waiterId: form.waiterId,
        amount,
        description: form.description,
        paymentType: form.paymentType,
      });
      setForm({ waiterId: '', amount: '', description: '', paymentType: 'cash' });
      setShowForm(false);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCash = advances
    .filter((a) => (a.paymentType || 'cash') === 'cash')
    .reduce((s, a) => s + a.amount, 0);
  const totalClick = advances.filter((a) => a.paymentType === 'click').reduce((s, a) => s + a.amount, 0);

  const PER = 7;
  const totalPages = Math.max(1, Math.ceil(advances.length / PER));
  const curPage = Math.min(page, totalPages);
  const visible = advances.slice((curPage - 1) * PER, curPage * PER);

  return (
    <div style={{ flex: 1, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SubHeader title="Авансы официантам" onBack={() => ctx.go('orders')}>
        <CTA onClick={() => setShowForm(true)} fullWidth={false} height={48} fontSize={15}>
          <NavIcon kind="plus" color="#fff" /> ВЫДАТЬ АВАНС
        </CTA>
      </SubHeader>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showForm ? '1fr 460px' : '1fr',
          gap: 18,
          padding: 22,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <MiniStat label="Наличные доступно" value={fmt(availableCash)} color={T.ready} large />
            <MiniStat label="Перевод доступно" value={fmt(availableClick)} color={T.served} large />
            <MiniStat label="Аванс наличными" value={fmt(totalCash)} color={T.preparing} large />
            <MiniStat label="Аванс перевод" value={fmt(totalClick)} color={T.hourly} large />
          </div>
          {!ctx.activeShift && (
            <div
              style={{
                background: T.preparingBg,
                color: T.preparing,
                padding: 12,
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Нет активной смены — откройте смену, чтобы видеть авансы.
            </div>
          )}
          <SectionTitle>Список авансов</SectionTitle>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Загрузка…</div>
            ) : advances.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Авансы не найдены</div>
            ) : (
              visible.map((a) => {
                const isCash = (a.paymentType || 'cash') === 'cash';
                return (
                  <div
                    key={a._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr 130px 110px 110px',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 6px',
                      borderBottom: `1px solid ${T.borderSoft}`,
                    }}
                  >
                    <span style={{ fontSize: 13, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(a.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{a.waiterName || 'Неизвестно'}</div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>{a.description || '—'}</div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        background: isCash ? T.readyBg : '#f8d9c0',
                        color: isCash ? T.ready : T.cta,
                      }}
                    >
                      {isCash ? 'НАЛИЧНЫЕ' : 'ПЕРЕВОД'}
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                        color: T.cancelled,
                      }}
                    >
                      −{fmt(a.amount)}
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: 'center',
                        background: a.status === 'settled' ? T.paidBg : T.preparingBg,
                        color: a.status === 'settled' ? T.paid : T.preparing,
                      }}
                    >
                      {a.status === 'settled' ? 'ПОГАШЕНО' : 'НЕ ПОГАШЕНО'}
                    </span>
                  </div>
                );
              })
            )}
            <div style={{ flex: 1 }} />
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                <Pager
                  page={curPage}
                  total={totalPages}
                  vertical={false}
                  onPrev={() => setPage(Math.max(1, curPage - 1))}
                  onNext={() => setPage(Math.min(totalPages, curPage + 1))}
                />
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflow: 'hidden',
            }}
          >
            <SectionTitle>Новый аванс</SectionTitle>
            <FormField label="Официант *">
              <select
                value={form.waiterId}
                onChange={(e) => setForm({ ...form, waiterId: e.target.value })}
                style={{
                  height: 52,
                  padding: '0 14px',
                  background: T.panel,
                  border: `2px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 16,
                }}
              >
                <option value="">Выберите официанта</option>
                {waiters.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Тип оплаты">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['cash', 'click'] as const).map((p) => {
                  const a = form.paymentType === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, paymentType: p })}
                      style={{
                        padding: 14,
                        background: a ? (p === 'cash' ? T.ready : T.served) : T.panel,
                        color: a ? '#fff' : T.text,
                        border: `2px solid ${a ? (p === 'cash' ? T.ready : T.served) : T.border}`,
                        fontFamily: T.font,
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {p === 'cash' ? 'Наличные' : 'Перевод'}
                    </button>
                  );
                })}
              </div>
            </FormField>
            <FormField label="Сумма *">
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: fmtInput(e.target.value) })}
                placeholder="0"
                style={{
                  height: 56,
                  padding: '0 16px',
                  background: T.panel,
                  border: `2px solid ${T.borderStrong}`,
                  fontFamily: T.font,
                  fontSize: 24,
                  fontWeight: 800,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </FormField>
            <FormField label="Комментарий">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Например: до зарплаты"
                style={{
                  minHeight: 60,
                  padding: 12,
                  background: T.panel,
                  border: `2px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 15,
                  resize: 'none',
                }}
              />
            </FormField>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setShowForm(false)} fullWidth height={60}>
                Отмена
              </Btn>
              <CTA onClick={submit} height={60} fontSize={17} disabled={submitting}>
                <NavIcon kind="check" color="#fff" /> {submitting ? 'Выдача…' : 'Выдать'}
              </CTA>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
