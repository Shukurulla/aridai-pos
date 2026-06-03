import { useEffect, useState, useCallback } from 'react'
import { T } from '../lib/theme'

const KINDS = [
  { id: 'cashier', label: 'Касса (чеки, отчёты)' },
  { id: 'kitchen', label: 'Кухня' },
  { id: 'bar', label: 'Бар' },
  { id: 'custom', label: 'Другое' }
]

const ROLE_LABEL = (r) => {
  const x = String(r || '').toLowerCase()
  if (['cook', 'kitchen', 'chef', 'oshpaz', 'povar', 'повар', 'кухня'].includes(x)) return 'Повар'
  if (['cashier', 'kassir', 'кассир'].includes(x)) return 'Кассир'
  if (['admin', 'owner'].includes(x)) return 'Админ'
  if (['waiter', 'ofitsiant'].includes(x)) return 'Официант'
  return r || '—'
}
const isCook = (r) =>
  ['cook', 'kitchen', 'chef', 'oshpaz', 'povar', 'повар', 'кухня'].includes(String(r || '').toLowerCase())

const empty = { name: '', device_name: '', kind: 'cashier', is_default: false }

export default function PrintersPage() {
  const [list, setList] = useState([])
  const [devices, setDevices] = useState([])
  const [categories, setCategories] = useState([])
  const [foods, setFoods] = useState([])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [logoOn, setLogoOn] = useState(true)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoCustom, setLogoCustom] = useState(false)

  const load = useCallback(async () => {
    const r = await window.aridai.printers.list()
    setList(r.success ? r.data || [] : [])
  }, [])

  const loadDevices = useCallback(async () => {
    const r = await window.aridai.printers.devices()
    setDevices(r.success ? r.data || [] : [])
  }, [])

  const loadCategories = useCallback(async () => {
    const r = await window.aridai.categories.list()
    setCategories(r.success ? r.data || [] : [])
  }, [])

  const loadFoods = useCallback(async () => {
    const r = await window.aridai.foods.list()
    setFoods(r.success ? r.data || [] : [])
  }, [])

  const loadLogo = useCallback(async () => {
    const r = await window.aridai.printers.logoGet()
    if (r && r.success) {
      setLogoOn(r.enabled !== false)
      setLogoCustom(!!r.custom)
      setLogoPreview(r.preview || null)
    }
  }, [])

  const toggleLogo = async () => {
    const next = !logoOn
    setLogoOn(next)
    await window.aridai.printers.logoSet(next)
  }

  const uploadLogo = (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const r = await window.aridai.printers.logoUpload(String(reader.result))
      if (r && r.success) {
        setMsg('✓ Логотип обновлён')
        loadLogo()
      } else setMsg('Ошибка: ' + ((r && r.error) || ''))
    }
    reader.readAsDataURL(file)
  }

  const resetLogo = async () => {
    const r = await window.aridai.printers.logoClear()
    if (r && r.success) {
      setMsg('✓ Логотип сброшен на стандартный')
      loadLogo()
    }
  }

  useEffect(() => {
    load()
    loadDevices()
    loadCategories()
    loadFoods()
    loadLogo()
  }, [load, loadDevices, loadCategories, loadFoods, loadLogo])

  const save = async () => {
    if (!form.name || !form.device_name) {
      setMsg('Введите название и выберите принтер из списка')
      return
    }
    setBusy(true)
    setMsg('')
    const r = await window.aridai.printers.save(form)
    setBusy(false)
    if (r.success) {
      // Yangi printer — loginlarni biriktirish uchun tahrirda qoldiramiz
      if (!form.id && r.data?.id) setForm({ ...r.data })
      else setForm(null)
      load()
      setMsg('✓ Сохранено')
    } else setMsg(r.error || 'Ошибка сохранения')
  }

  const remove = async (id) => {
    if (!confirm('Удалить принтер? Привязанные логины тоже удалятся.')) return
    await window.aridai.printers.remove(id)
    if (form && form.id === id) setForm(null)
    load()
  }

  const test = async (id) => {
    setMsg('Печать теста…')
    const r = await window.aridai.printers.test(id)
    setMsg(r.success ? '✓ Тест отправлен на принтер' : 'Ошибка: ' + (r.error || ''))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Принтеры</h1>
          <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 24px', maxWidth: 620 }}>
            Выберите принтер, подключённый к этому компьютеру. Привяжите логины — роль логина решает, что
            печатается: <b>повар</b> → чеки кухни (новый заказ, добавленные блюда, отмена); <b>кассир</b> →
            чеки оплаты и отчёты. К одному принтеру можно привязать несколько логинов.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 14,
              background: T.surface,
              border: `2px solid ${logoOn ? T.cta : T.border}`
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                flexShrink: 0,
                background: '#fff',
                border: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
              ) : (
                <span style={{ fontSize: 11, color: T.textMuted }}>нет</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                <input type="checkbox" checked={logoOn} onChange={toggleLogo} style={{ width: 18, height: 18 }} />
                Логотип на чеке
              </label>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                {logoCustom ? 'Загружен свой логотип.' : 'Стандартный логотип.'} Лучше всего —
                чёрно-белый PNG. Если принтер печатает «кашу» вместо картинки — снимите галочку.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ ...btn(T.cta, '#fff'), display: 'inline-flex', alignItems: 'center' }}>
                  Загрузить логотип
                  <input type="file" accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
                </label>
                {logoCustom && (
                  <button onClick={resetLogo} style={btn(T.surface, T.text, true)}>
                    Сбросить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadDevices} style={btn(T.surface, T.text, true)}>
            Обновить список
          </button>
          <button onClick={() => setForm({ ...empty })} style={btn(T.cta, '#fff')}>
            + Добавить принтер
          </button>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            background: msg.startsWith('✓') ? T.readyBg : T.panelStrong,
            color: msg.startsWith('✓') ? T.ready : T.text,
            fontWeight: 700,
            fontSize: 14
          }}
        >
          {msg}
        </div>
      )}

      {form && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>
            {form.id ? 'Изменить принтер' : 'Новый принтер'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Название">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Касса 1 / Кухня плита"
                style={inp}
              />
            </Field>
            <Field label="Принтер (подключённый к ПК)">
              <select
                value={form.device_name || ''}
                onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                style={inp}
              >
                <option value="">— выберите принтер —</option>
                {devices.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.displayName}
                    {d.isDefault ? ' (по умолчанию)' : ''}
                  </option>
                ))}
                {form.device_name && !devices.find((d) => d.name === form.device_name) && (
                  <option value={form.device_name}>{form.device_name} (не найден сейчас)</option>
                )}
              </select>
            </Field>
            <Field label="Назначение (резерв)">
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={inp}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, height: 46 }}
              >
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                Принтер по умолчанию (касса)
              </label>
            </div>
          </div>

          {devices.length === 0 && (
            <div style={{ marginTop: 10, fontSize: 13, color: T.cancelled }}>
              Принтеры в системе не найдены. Установите принтер в ОС и нажмите «Обновить список».
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setForm(null)} style={btn(T.surface, T.text, true)}>
              Закрыть
            </button>
            <button onClick={save} disabled={busy} style={btn(T.cta, '#fff')}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>

          {form.id && <LoginsPanel printerId={form.id} categories={categories} foods={foods} />}
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        {list.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.textMuted }}>
            Принтеры не добавлены. Нажмите «+ Добавить принтер».
          </div>
        ) : (
          list.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom: `1px solid ${T.borderSoft}`
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.name}
                  {!!p.is_default && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: T.readyBg,
                        color: T.ready,
                        padding: '2px 8px'
                      }}
                    >
                      ПО УМОЛЧАНИЮ
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                  {p.device_name || p.ip_address || '— устройство не выбрано —'} ·{' '}
                  {KINDS.find((k) => k.id === p.kind)?.label || p.kind}
                </div>
              </div>
              <button onClick={() => test(p.id)} style={btn(T.surface, T.text, true)}>
                Тест
              </button>
              <button
                onClick={() => setForm({ ...p, is_default: !!p.is_default })}
                style={btn(T.surface, T.text, true)}
              >
                Логины / Изменить
              </button>
              <button onClick={() => remove(p.id)} style={btn(T.cancelledBg, T.cancelled)}>
                Удалить
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function LoginsPanel({ printerId, categories, foods }) {
  const [logins, setLogins] = useState([])
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const reload = useCallback(async () => {
    const r = await window.aridai.printers.loginList(printerId)
    setLogins(r.success ? r.data || [] : [])
  }, [printerId])

  useEffect(() => {
    reload()
  }, [reload])

  const add = async () => {
    if (!phone || !password) {
      setErr('Введите телефон и пароль')
      return
    }
    setBusy(true)
    setErr('')
    const r = await window.aridai.printers.loginAdd(printerId, phone, password)
    setBusy(false)
    if (r.success) {
      setPhone('')
      setPassword('')
      reload()
    } else setErr(r.error || 'Не удалось войти')
  }

  const removeLogin = async (id) => {
    await window.aridai.printers.loginRemove(id)
    reload()
  }

  return (
    <div style={{ marginTop: 22, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Логины принтера</div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
        Войдите под логином сотрудника. Роль логина определяет, что печатается на этот принтер.
      </div>

      {logins.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {logins.map((l) => (
            <LoginRow key={l.id} login={l} categories={categories} foods={foods} onRemove={() => removeLogin(l.id)} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Field label="Телефон логина">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 700 000 00 00"
              style={inp}
            />
          </Field>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Field label="Пароль">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={inp}
            />
          </Field>
        </div>
        <button onClick={add} disabled={busy} style={btn(T.cta, '#fff')}>
          {busy ? 'Проверка…' : '+ Привязать логин'}
        </button>
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 13, color: T.cancelled, fontWeight: 700 }}>{err}</div>}
    </div>
  )
}

function LoginRow({ login, categories, foods, onRemove }) {
  const cook = isCook(login.role)
  const [open, setOpen] = useState(false)
  const [openF, setOpenF] = useState(false)
  const [fq, setFq] = useState('')
  let selected = []
  let selectedF = []
  try {
    selected = JSON.parse(login.category_ids || '[]')
  } catch {
    selected = []
  }
  try {
    selectedF = JSON.parse(login.food_ids || '[]')
  } catch {
    selectedF = []
  }
  const [sel, setSel] = useState(selected.map(String))
  const [selF, setSelF] = useState(selectedF.map(String))

  const toggle = async (cid) => {
    const next = sel.includes(cid) ? sel.filter((x) => x !== cid) : [...sel, cid]
    setSel(next)
    await window.aridai.printers.loginCategories(login.id, next)
  }
  const toggleFood = async (fid) => {
    const next = selF.includes(fid) ? selF.filter((x) => x !== fid) : [...selF, fid]
    setSelF(next)
    await window.aridai.printers.loginFoods(login.id, next)
  }
  const foodList = (foods || []).filter(
    (f) => !fq.trim() || String(f.food_name || '').toLowerCase().includes(fq.trim().toLowerCase())
  )

  return (
    <div style={{ border: `1px solid ${T.borderSoft}`, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            {login.staff_name || login.phone}
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                background: cook ? T.panelStrong : T.readyBg,
                color: cook ? T.text : T.ready,
                padding: '2px 8px'
              }}
            >
              {ROLE_LABEL(login.role)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{login.phone}</div>
        </div>
        {cook && (
          <button onClick={() => { setOpen(!open); setOpenF(false) }} style={btn(T.surface, T.text, true)}>
            Категории ({sel.length || 'все'})
          </button>
        )}
        {cook && (
          <button onClick={() => { setOpenF(!openF); setOpen(false) }} style={btn(T.surface, T.text, true)}>
            Блюда ({selF.length || '0'})
          </button>
        )}
        <button onClick={onRemove} style={btn(T.cancelledBg, T.cancelled)}>
          Убрать
        </button>
      </div>
      {cook && open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ width: '100%', fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
            Не выбрано — печатается весь заказ. Выберите категории, за которые отвечает этот повар.
          </div>
          {categories.map((c) => (
            <label
              key={c._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                border: `1px solid ${sel.includes(String(c._id)) ? T.cta : T.border}`,
                padding: '6px 10px',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={sel.includes(String(c._id))}
                onChange={() => toggle(String(c._id))}
              />
              {c.title}
            </label>
          ))}
          {categories.length === 0 && (
            <div style={{ fontSize: 13, color: T.textMuted }}>Категории ещё не синхронизированы.</div>
          )}
        </div>
      )}
      {cook && openF && (
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ fontSize: 12, color: T.textMuted, margin: '0 0 6px' }}>
            Отдельные блюда для этого повара/бара (помимо категорий). Полезно,
            когда блюдо из общей категории должно идти сюда.
          </div>
          <input
            value={fq}
            onChange={(e) => setFq(e.target.value)}
            placeholder="Поиск блюда…"
            style={{
              width: '100%',
              padding: '7px 10px',
              border: `1px solid ${T.border}`,
              marginBottom: 8,
              fontSize: 13
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 240, overflow: 'auto' }}>
            {foodList.map((f) => (
              <label
                key={f._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  border: `1px solid ${selF.includes(String(f._id)) ? T.cta : T.border}`,
                  padding: '6px 10px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={selF.includes(String(f._id))}
                  onChange={() => toggleFood(String(f._id))}
                />
                {f.food_name}
              </label>
            ))}
            {foodList.length === 0 && (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                {(foods || []).length === 0 ? 'Блюда ещё не синхронизированы.' : 'Ничего не найдено.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          color: T.textMuted,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 0.4
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = {
  height: 46,
  padding: '0 12px',
  background: T.panel,
  border: `2px solid ${T.border}`,
  fontFamily: T.font,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%'
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
