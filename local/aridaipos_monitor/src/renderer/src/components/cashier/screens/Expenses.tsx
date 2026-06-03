'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Expense, ExpenseCategory } from '@/types';
import { T, NavIcon, fmt } from '@/lib/theme';
import { SubHeader, SectionTitle, MiniStat, CTA, Btn, FormField, Pager } from '../shell';
import { ScreenCtx } from './types';

export function ExpensesScreen({ ctx }: { ctx: ScreenCtx }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [availableCash, setAvailableCash] = useState(0);
  const [availableClick, setAvailableClick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [form, setForm] = useState({
    categoryId: '',
    amount: '',
    description: '',
    paymentType: 'cash' as 'cash' | 'click',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const shiftId = ctx.activeShift?._id || null;
      const [exp, cats, bal] = await Promise.all([
        shiftId ? api.getExpensesByShift(shiftId) : Promise.resolve([]),
        api.getExpenseCategories(),
        api.getAvailableBalances(),
      ]);
      setExpenses(exp);
      setCategories(cats);
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
    if (formType === 'expense' && !form.categoryId) {
      alert('Выберите категорию');
      return;
    }
    const amount = parseAmount(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    if (formType === 'expense') {
      if (form.paymentType === 'click' && amount > availableClick) {
        alert(`Недостаточно средств на переводе!\nДоступно: ${fmt(availableClick)}`);
        return;
      }
      if (form.paymentType === 'cash' && amount > availableCash) {
        alert(`Недостаточно наличных!\nДоступно: ${fmt(availableCash)}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await api.createExpense({
        ...(form.categoryId && { categoryId: form.categoryId }),
        amount,
        description: form.description,
        type: formType,
        paymentType: form.paymentType,
      });
      setForm({ categoryId: '', amount: '', description: '', paymentType: 'cash' });
      setShowForm(false);
      setFormType('expense');
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const cashExpenses = expenses
    .filter((e) => (e.type || 'expense') === 'expense' && (e.paymentType || 'cash') === 'cash')
    .reduce((s, e) => s + e.amount, 0);
  const clickExpenses = expenses
    .filter((e) => (e.type || 'expense') === 'expense' && e.paymentType === 'click')
    .reduce((s, e) => s + e.amount, 0);

  const PER = 7;
  const totalPages = Math.max(1, Math.ceil(expenses.length / PER));
  const curPage = Math.min(page, totalPages);
  const visible = expenses.slice((curPage - 1) * PER, curPage * PER);

  return (
    <div style={{ flex: 1, background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SubHeader title="Расходы за смену" onBack={() => ctx.go('orders')}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn
            onClick={() => {
              setFormType('income');
              setForm({ categoryId: '', amount: '', description: '', paymentType: 'cash' });
              setShowForm(true);
            }}
            color={T.ready}
            bg={T.readyBg}
            height={48}
          >
            <NavIcon kind="plus" color={T.ready} /> Приход
          </Btn>
          <CTA
            onClick={() => {
              setFormType('expense');
              setForm({ categoryId: '', amount: '', description: '', paymentType: 'cash' });
              setShowForm(true);
            }}
            fullWidth={false}
            height={48}
            fontSize={15}
          >
            <NavIcon kind="plus" color="#fff" /> ДОБАВИТЬ РАСХОД
          </CTA>
        </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <MiniStat label="Наличные доступно" value={fmt(availableCash)} color={T.ready} large />
            <MiniStat label="Перевод доступно" value={fmt(availableClick)} color={T.served} large />
            <MiniStat label="Расход всего" value={fmt(cashExpenses + clickExpenses)} color={T.cancelled} large />
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
              Нет активной смены — откройте смену, чтобы видеть расходы.
            </div>
          )}
          <SectionTitle>Список расходов</SectionTitle>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Загрузка…</div>
            ) : expenses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>Расходы не найдены</div>
            ) : (
              visible.map((e) => {
                const isIncome = e.type === 'income';
                const isCash = (e.paymentType || 'cash') === 'cash';
                return (
                  <div
                    key={e._id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr 130px 110px 90px',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 6px',
                      borderBottom: `1px solid ${T.borderSoft}`,
                    }}
                  >
                    <span style={{ fontSize: 13, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(e.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{e.categoryName || 'Без категории'}</div>
                      <div style={{ fontSize: 13, color: T.textMuted }}>{e.description || '—'}</div>
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
                        color: isIncome ? T.ready : T.cancelled,
                      }}
                    >
                      {isIncome ? '+' : '−'}
                      {fmt(e.amount)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: 'center',
                        color: T.textMuted,
                      }}
                    >
                      {isIncome ? 'Приход' : 'Расход'}
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
            <SectionTitle>{formType === 'income' ? 'Новый приход (возврат)' : 'Новый расход'}</SectionTitle>
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
            <FormField label={`Категория ${formType === 'expense' ? '*' : '(необязательно)'}`}>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                style={{
                  height: 52,
                  padding: '0 14px',
                  background: T.panel,
                  border: `2px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 16,
                }}
              >
                <option value="">Выберите категорию</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                placeholder="Например: овощи, рынок"
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
              <CTA
                onClick={submit}
                height={60}
                fontSize={17}
                color={formType === 'income' ? T.ready : T.cta}
                disabled={submitting}
              >
                <NavIcon kind="check" color="#fff" /> {submitting ? 'Сохранение…' : 'Сохранить'}
              </CTA>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
