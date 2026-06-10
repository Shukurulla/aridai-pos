import { Fragment, useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { Icon } from "../icons";

// СОТРУДНИКИ (keldi-ketti) — obsidian/04-toollar/keldi-ketti.md
// 1) Davomat (kun bo'yicha, qo'lda keldi/ketdi — offline fallback)
// 2) Maosh qoidalari (daily/monthly/fixedShift/percentService/perDish)
// 3) Payroll (oy → hisoblash → выплатить)
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
const hm = (d) => (d ? new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—");
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const TYPE_RU = {
  daily: "Дневная ставка",
  monthly: "Оклад (месяц)",
  fixedShift: "За ночную смену",
  percentService: "% от выручки",
  perDish: "За блюда (повар)",
};
const ROLE_RU = { waiter: "Официант", cook: "Повар", cashier: "Кассир", branch_admin: "Администратор" };

export default function Personal() {
  const { branchId } = useAuth();
  const modal = useModal();
  const [disabled, setDisabled] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [staff, setStaff] = useState([]);
  const [foods, setFoods] = useState([]);
  const [date, setDate] = useState(today());
  const [atts, setAtts] = useState([]);
  const [rules, setRules] = useState([]);
  const [period, setPeriod] = useState(thisMonth());
  const [payroll, setPayroll] = useState([]);
  const [ruleForm, setRuleForm] = useState(null); // {user, rule}
  const [expanded, setExpanded] = useState(null); // payroll breakdown

  const loadAll = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.kkAttendance(`date=${date}`), api.kkRules()]);
      setAtts(a.data || []);
      setRules(r.data || []);
      setDisabled(false);
      setErr("");
    } catch (e) {
      if (e.code === "FEATURE_DISABLED") setDisabled(true);
      else setErr(e.message);
    }
  }, [date]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!branchId) return;
    api.staff(branchId).then((r) => setStaff((r.data || []).filter((u) => u.isActive !== false))).catch(() => {});
    api.foods(branchId).then((r) => setFoods(r.data || [])).catch(() => {});
  }, [branchId]);

  const loadPayroll = useCallback(async () => {
    try {
      const r = await api.kkPayroll(period);
      setPayroll(r.data || []);
    } catch (e) {
      if (e.code !== "FEATURE_DISABLED") setErr(e.message);
    }
  }, [period]);
  useEffect(() => {
    if (!disabled) loadPayroll();
  }, [loadPayroll, disabled]);

  const manual = async (userId, action) => {
    setBusy(true);
    try {
      await api.kkManual(userId, action);
      await loadAll();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const calc = async () => {
    setBusy(true);
    try {
      await api.kkPayrollCalc(period);
      await loadPayroll();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const pay = async (p) => {
    const ok = await modal.confirm({
      title: `Выплатить ${p.userName}?`,
      message: `${fmt(p.totalAmount)} за ${p.period}. Отметка о выплате необратима.`,
      okText: "Выплачено",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.kkPayrollPay(p._id);
      await loadPayroll();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  const openRule = (u) => {
    const rule = rules.find((r) => String(r.userId) === String(u._id));
    setRuleForm({
      user: u,
      type: rule?.type || (u.role === "cook" ? "perDish" : u.role === "waiter" ? "percentService" : "daily"),
      amount: String(rule?.amount || ""),
      percent: String(rule?.percent || ""),
      start: rule?.schedule?.start || "",
      end: rule?.schedule?.end || "",
      grace: String(rule?.lateGraceMinutes ?? 5),
      penalty: String(rule?.penaltyPerMinute || ""),
      perDishMap: (rule?.perDishMap || []).map((p) => ({
        foodId: String(p.foodId),
        foodName: p.foodName,
        amount: String(p.amount),
      })),
    });
  };

  const saveRule = async () => {
    const f = ruleForm;
    setBusy(true);
    try {
      await api.kkRuleSave({
        userId: f.user._id,
        type: f.type,
        amount: Number(f.amount) || 0,
        percent: Number(f.percent) || 0,
        schedule: { start: f.start || null, end: f.end || null },
        lateGraceMinutes: Number(f.grace) || 0,
        penaltyPerMinute: Number(f.penalty) || 0,
        perDishMap: f.perDishMap
          .filter((p) => p.foodId && Number(p.amount) > 0)
          .map((p) => ({
            foodId: p.foodId,
            foodName: foods.find((x) => String(x._id) === p.foodId)?.name || p.foodName,
            amount: Number(p.amount),
          })),
      });
      setRuleForm(null);
      await loadAll();
    } catch (e) {
      await modal.alert({ title: "Ошибка", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <div>
        <div className="page-head"><h1>Сотрудники</h1></div>
        <div className="card">
          <div className="empty">
            Модуль «Учёт времени» выключен для вашего ресторана.
            <br />
            Включите его в панели владельца (Функции → Учёт времени) — появится
            учёт прихода/ухода, опоздания и автоматический расчёт зарплаты.
          </div>
        </div>
      </div>
    );
  }

  const attByUser = new Map(atts.map((a) => [String(a.userId), a]));
  const isToday = date === today();

  return (
    <div>
      <div className="page-head">
        <h1>Сотрудники</h1>
        <div className="row">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn ghost btn-sm icon-btn" onClick={loadAll}>
            <Icon name="refresh" size={15} /> Обновить
          </button>
        </div>
      </div>

      {err && <div className="alert err">{err}</div>}

      <h2 className="sub-h">Посещаемость — {date}</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Роль</th>
              <th>Пришёл</th>
              <th>Ушёл</th>
              <th>Опоздание</th>
              <th style={{ width: 220 }}></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => {
              const a = attByUser.get(String(u._id));
              return (
                <tr key={u._id}>
                  <td style={{ fontWeight: 800 }}>{u.name}</td>
                  <td className="muted">{ROLE_RU[u.role] || u.role}</td>
                  <td>{a?.arrivedAt ? hm(a.arrivedAt) : "—"}</td>
                  <td>{a?.leftAt ? hm(a.leftAt) : "—"}</td>
                  <td>
                    {a?.isLate ? (
                      <span className="disc-neg">
                        {a.lateMinutes} мин{a.penalty > 0 ? ` · −${fmt(a.penalty)}` : ""}
                      </span>
                    ) : a?.arrivedAt ? (
                      <span className="disc-pos">вовремя</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {isToday && !a?.arrivedAt && (
                      <button className="btn btn-sm" onClick={() => manual(u._id, "in")} disabled={busy}>Пришёл</button>
                    )}{" "}
                    {isToday && a?.arrivedAt && !a?.leftAt && (
                      <button className="btn btn-sm ghost" onClick={() => manual(u._id, "out")} disabled={busy}>Ушёл</button>
                    )}{" "}
                    <button className="btn btn-sm ghost" onClick={() => openRule(u)} disabled={busy}>Оплата</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="sub-h">Зарплата</h2>
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 12, alignItems: "center" }}>
          <input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 170 }} />
          <button className="btn btn-primary" onClick={calc} disabled={busy}>
            {busy ? "…" : "Рассчитать"}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Повторный расчёт обновляет суммы (до отметки «Выплачено»).
          </span>
        </div>
        {payroll.length === 0 ? (
          <div className="empty">Нет расчётов за {period}. Настройте «Оплата» сотрудникам и нажмите «Рассчитать».</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Тип</th>
                <th style={{ textAlign: "right" }}>Дней</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                <th>Статус</th>
                <th style={{ width: 180 }}></th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((p) => (
                <Fragment key={p._id}>
                  <tr>
                    <td style={{ fontWeight: 800 }}>{p.userName}</td>
                    <td className="muted">{TYPE_RU[p.ruleType] || p.ruleType}</td>
                    <td style={{ textAlign: "right" }}>{p.workedDays}</td>
                    <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(p.totalAmount)}</td>
                    <td>{p.paidAt ? <span className="disc-pos">выплачено</span> : <span className="muted">рассчитано</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm ghost" onClick={() => setExpanded(expanded === p._id ? null : p._id)}>
                        Детали
                      </button>{" "}
                      {!p.paidAt && (
                        <button className="btn btn-sm btn-primary" onClick={() => pay(p)} disabled={busy}>
                          Выплатить
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === p._id && (
                    <tr>
                      <td colSpan={6} style={{ background: "#faf7f0" }}>
                        {(p.breakdown || []).map((b, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 8px", fontSize: 13 }}>
                            <span>{b.label}</span>
                            <span className={b.amount < 0 ? "disc-neg" : ""} style={{ fontWeight: 700 }}>
                              {fmt(b.amount)}
                            </span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ruleForm && (
        <div className="modal-overlay" onMouseDown={() => !busy && setRuleForm(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Оплата — {ruleForm.user.name}</h3>
              <button className="x-btn" onClick={() => setRuleForm(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Тип оплаты</label>
                <select className="select" value={ruleForm.type} onChange={(e) => setRuleForm((f) => ({ ...f, type: e.target.value }))}>
                  {Object.entries(TYPE_RU).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {["daily", "monthly", "fixedShift"].includes(ruleForm.type) && (
                <div className="field">
                  <label>
                    {ruleForm.type === "daily" ? "Ставка за день" : ruleForm.type === "monthly" ? "Оклад за месяц" : "За ночную смену"}
                  </label>
                  <input className="input" inputMode="numeric" value={ruleForm.amount}
                    onChange={(e) => setRuleForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, "") }))} />
                </div>
              )}

              {ruleForm.type === "percentService" && (
                <div className="field">
                  <label>% от выручки его заказов</label>
                  <input className="input" inputMode="numeric" value={ruleForm.percent}
                    onChange={(e) => setRuleForm((f) => ({ ...f, percent: e.target.value.replace(/\D/g, "") }))} />
                </div>
              )}

              {ruleForm.type === "perDish" && (
                <div className="field">
                  <label>Блюда и сумма за порцию</label>
                  {ruleForm.perDishMap.map((p, i) => (
                    <div className="row" key={i} style={{ gap: 8, marginBottom: 6 }}>
                      <select className="select" style={{ flex: 2 }} value={p.foodId}
                        onChange={(e) => setRuleForm((f) => {
                          const rows = [...f.perDishMap];
                          rows[i] = { ...rows[i], foodId: e.target.value };
                          return { ...f, perDishMap: rows };
                        })}>
                        <option value="">— блюдо —</option>
                        {foods.map((x) => (
                          <option key={x._id} value={x._id}>{x.name}</option>
                        ))}
                      </select>
                      <input className="input" style={{ flex: 1 }} inputMode="numeric" placeholder="сумма" value={p.amount}
                        onChange={(e) => setRuleForm((f) => {
                          const rows = [...f.perDishMap];
                          rows[i] = { ...rows[i], amount: e.target.value.replace(/\D/g, "") };
                          return { ...f, perDishMap: rows };
                        })} />
                      <button type="button" className="btn ghost btn-sm"
                        onClick={() => setRuleForm((f) => ({ ...f, perDishMap: f.perDishMap.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost btn-sm"
                    onClick={() => setRuleForm((f) => ({ ...f, perDishMap: [...f.perDishMap, { foodId: "", amount: "" }] }))}>
                    + Блюдо
                  </button>
                </div>
              )}

              <div className="row" style={{ gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>График: приход</label>
                  <input type="time" className="input" value={ruleForm.start}
                    onChange={(e) => setRuleForm((f) => ({ ...f, start: e.target.value }))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>уход</label>
                  <input type="time" className="input" value={ruleForm.end}
                    onChange={(e) => setRuleForm((f) => ({ ...f, end: e.target.value }))} />
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Грейс (мин)</label>
                  <input className="input" inputMode="numeric" value={ruleForm.grace}
                    onChange={(e) => setRuleForm((f) => ({ ...f, grace: e.target.value.replace(/\D/g, "") }))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Штраф за минуту</label>
                  <input className="input" inputMode="numeric" value={ruleForm.penalty}
                    onChange={(e) => setRuleForm((f) => ({ ...f, penalty: e.target.value.replace(/\D/g, "") }))} />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setRuleForm(null)} disabled={busy}>Отмена</button>
              <button className="btn btn-primary" onClick={saveRule} disabled={busy}>
                {busy ? "…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
