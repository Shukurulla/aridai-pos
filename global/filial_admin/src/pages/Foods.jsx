import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { Icon } from "../icons";

const fmt = (n) => Number(n || 0).toLocaleString("ru-RU");
// Retsept qatorlarini tozalash: ingredient tanlangan + miqdor > 0 bo'lganlar
const cleanRecipe = (rows, ings) =>
  (rows || [])
    .filter((r) => r.ingredientId && Number(r.quantity) > 0)
    .map((r) => ({
      ingredientId: r.ingredientId,
      quantity: Number(r.quantity),
      unit: ings.find((i) => String(i._id) === String(r.ingredientId))?.unit || r.unit || "dona",
    }));
const empty = { name: "", category: "", price: "", isHourly: false, description: "", recipe: [] };

export default function Foods({ onBranchName }) {
  const { branchId, restaurantId } = useAuth();
  const dlg = useModal();
  const [foods, setFoods] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {form, id, image}
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // SKLAD retsept (BOM) — toggle yoqiq bo'lsa ingredientlar yuklanadi, aks holda
  // bo'sh ro'yxat (retsept bo'limi ko'rinmaydi).
  const [ingredients, setIngredients] = useState([]);
  const fileRef = useRef(null);
  const imgInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([api.foods(branchId), api.categories(branchId)]);
      setFoods(f.data || []);
      setCats(c.data || []);
      const bn = (f.data || [])[0]?.branch?.name;
      if (bn && onBranchName) onBranchName(bn);
    } catch {
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, onBranchName]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api
      .skladIngredients()
      .then((r) => setIngredients(r.data || []))
      .catch(() => setIngredients([])); // FEATURE_DISABLED — retsept bo'limi yashirin
  }, []);

  const catName = (c) => (typeof c === "object" ? c?.title : cats.find((x) => x._id === c)?.title) || "—";

  const resetImage = () => {
    setImageFile(null);
    setImagePreview("");
  };
  const openNew = () => {
    setErr("");
    resetImage();
    setModal({ id: null, image: "", form: { ...empty, category: cats[0]?._id || "" } });
  };
  const openEdit = (f) => {
    setErr("");
    resetImage();
    setModal({
      id: f._id,
      image: f.image || "",
      form: {
        name: f.name,
        category: f.category?._id || f.category || "",
        price: String(f.price ?? ""),
        isHourly: f.isHourly === true,
        description: f.description || "",
        recipe: Array.isArray(f.recipe)
          ? f.recipe.map((r) => ({
              ingredientId: String(r.ingredientId?._id || r.ingredientId || ""),
              quantity: String(r.quantity ?? ""),
              unit: r.unit || "",
            }))
          : [],
      },
    });
  };
  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const pickImage = (file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const save = async () => {
    const f = modal.form;
    if (!f.name.trim() || !f.category || !(Number(f.price) >= 0)) {
      setErr("Заполните название, категорию и цену");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      let body;
      if (imageFile) {
        // Rasm bilan — multipart FormData
        body = new FormData();
        body.append("name", f.name.trim());
        body.append("category", f.category);
        body.append("price", String(Number(f.price)));
        body.append("isHourly", f.isHourly ? "true" : "false");
        body.append("description", f.description.trim());
        body.append("branch", branchId);
        body.append("restaurantId", restaurantId);
        body.append("image", imageFile);
        if (ingredients.length) body.append("recipe", JSON.stringify(cleanRecipe(f.recipe, ingredients)));
      } else {
        body = {
          name: f.name.trim(),
          category: f.category,
          price: Number(f.price),
          isHourly: !!f.isHourly,
          description: f.description.trim(),
          branch: branchId,
          restaurantId,
        };
        if (ingredients.length) body.recipe = cleanRecipe(f.recipe, ingredients);
      }
      if (modal.id) await api.foodUpdate(modal.id, body);
      else await api.foodCreate(body);
      setModal(null);
      resetImage();
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const del = async (f) => {
    if (!(await dlg.confirm({ title: "Удалить блюдо?", message: `«${f.name}» будет удалено.`, danger: true, okText: "Удалить" }))) return;
    try {
      await api.foodDelete(f._id);
      await load();
    } catch (e) {
      dlg.alert(e.message);
    }
  };

  // ===== Экспорт CSV =====
  const exportCsv = () => {
    const rows = [["name", "category", "price", "isHourly"]];
    foods.forEach((f) => rows.push([f.name, catName(f.category), f.price, f.isHourly ? "1" : "0"]));
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "menu.csv";
    a.click();
  };

  // ===== Импорт CSV (name,category,price,isHourly) =====
  const importCsv = async (file) => {
    const text = await file.text();
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return;
    const parse = (l) => l.match(/("([^"]|"")*"|[^,]*)/g).slice(0, -1).map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
    const header = parse(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (n) => header.indexOf(n);
    let ok = 0, fail = 0;
    const catMap = new Map(cats.map((c) => [c.title.toLowerCase(), c._id]));
    for (let i = 1; i < lines.length; i++) {
      const cols = parse(lines[i]);
      const name = (cols[idx("name")] || "").trim();
      const catTitle = (cols[idx("category")] || "").trim();
      const price = Number(cols[idx("price")] || 0);
      const isHourly = ["1", "true", "да"].includes(String(cols[idx("ishourly")] || "").trim().toLowerCase());
      if (!name || !catTitle) { fail++; continue; }
      try {
        let catId = catMap.get(catTitle.toLowerCase());
        if (!catId) {
          const r = await api.categoryCreate({ title: catTitle, branch: branchId, restaurantId });
          catId = r.data._id;
          catMap.set(catTitle.toLowerCase(), catId);
        }
        await api.foodCreate({ name, category: catId, price, isHourly, branch: branchId, restaurantId });
        ok++;
      } catch {
        fail++;
      }
    }
    dlg.alert({ title: "Импорт завершён", message: `Добавлено: ${ok}\nОшибок: ${fail}` });
    await load();
  };

  const shownPreview = imagePreview || modal?.image || "";

  return (
    <div>
      <div className="page-head">
        <h1>Меню</h1>
        <div className="row">
          <button className="btn ghost btn-sm icon-btn" onClick={exportCsv} disabled={!foods.length}>
            <Icon name="download" size={16} /> Экспорт
          </button>
          <button className="btn ghost btn-sm icon-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Импорт
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
          <button className="btn primary icon-btn" onClick={openNew} disabled={!cats.length}>
            <Icon name="plus" size={16} /> Блюдо
          </button>
        </div>
      </div>
      {!cats.length && !loading && (
        <div className="alert err">Сначала создайте хотя бы одну категорию (раздел «Категории»).</div>
      )}
      <div className="card">
        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : foods.length === 0 ? (
          <div className="empty">Нет блюд. Добавьте первое.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56 }}></th>
                <th>Название</th>
                <th>Категория</th>
                <th>Цена</th>
                <th style={{ width: 150, textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f._id}>
                  <td>
                    {f.image ? (
                      <img className="food-thumb" src={f.image} alt="" />
                    ) : (
                      <div className="food-thumb empty-thumb"><Icon name="image" size={18} /></div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {f.name} {f.isHourly && <span className="tag hourly">почасовая</span>}
                  </td>
                  <td className="muted">{catName(f.category)}</td>
                  <td style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(f.price)} ₸{f.isHourly ? "/ч" : ""}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm ghost icon-btn" onClick={() => openEdit(f)}>
                      <Icon name="edit" size={15} />
                    </button>{" "}
                    <button className="btn btn-sm danger icon-btn" onClick={() => del(f)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => !busy && setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? "Изменить блюдо" : "Новое блюдо"}</h2>
            {err && <div className="alert err">{err}</div>}

            <div className="field">
              <label>Фото блюда</label>
              <div className="img-upload" onClick={() => imgInputRef.current?.click()}>
                {shownPreview ? (
                  <img src={shownPreview} alt="" />
                ) : (
                  <div className="img-ph">
                    <Icon name="image" size={26} />
                    <span>Нажмите, чтобы добавить фото</span>
                  </div>
                )}
              </div>
              {shownPreview && (
                <button type="button" className="link-btn" onClick={resetImage}>
                  Убрать фото
                </button>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
            </div>

            <div className="field">
              <label>Название</label>
              <input className="input" value={modal.form.name} autoFocus
                onChange={(e) => setF("name", e.target.value)} placeholder="Плов" />
            </div>
            <div className="field">
              <label>Категория</label>
              <select className="select" value={modal.form.category} onChange={(e) => setF("category", e.target.value)}>
                {cats.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Цена {modal.form.isHourly ? "(за час)" : "(₸)"}</label>
              <input className="input" type="number" inputMode="numeric" value={modal.form.price}
                onChange={(e) => setF("price", e.target.value)} placeholder="1800" />
            </div>
            <div className="field">
              <div className={`switch ${modal.form.isHourly ? "on" : ""}`} onClick={() => setF("isHourly", !modal.form.isHourly)}>
                <span className="box"><span className="dot" /></span>
                <span style={{ fontWeight: 700 }}>Почасовая оплата (PlayStation, кабина…)</span>
              </div>
            </div>
            <div className="field">
              <label>Описание (необязательно)</label>
              <textarea className="input" value={modal.form.description}
                onChange={(e) => setF("description", e.target.value)} placeholder="" />
            </div>
            {ingredients.length > 0 && (
              <div className="field">
                <label>
                  Рецепт (расход со склада на 1 порцию){" "}
                  <span className="hint">— при заказе списывается автоматически</span>
                </label>
                {(modal.form.recipe || []).map((r, i) => (
                  <div className="row" key={i} style={{ gap: 8, marginBottom: 6 }}>
                    <select
                      className="select"
                      style={{ flex: 2 }}
                      value={r.ingredientId}
                      onChange={(e) => {
                        const rows = [...modal.form.recipe];
                        rows[i] = { ...rows[i], ingredientId: e.target.value };
                        setF("recipe", rows);
                      }}
                    >
                      <option value="">— ингредиент —</option>
                      {ingredients.map((ing) => (
                        <option key={ing._id} value={ing._id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      inputMode="decimal"
                      placeholder="кол-во"
                      value={r.quantity}
                      onChange={(e) => {
                        const rows = [...modal.form.recipe];
                        rows[i] = { ...rows[i], quantity: e.target.value.replace(/[^\d.]/g, "") };
                        setF("recipe", rows);
                      }}
                    />
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      onClick={() => setF("recipe", modal.form.recipe.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  onClick={() => setF("recipe", [...(modal.form.recipe || []), { ingredientId: "", quantity: "" }])}
                >
                  + Ингредиент
                </button>
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setModal(null)} disabled={busy}>Отмена</button>
              <button className="btn primary" onClick={save} disabled={busy}>{busy ? "…" : "Сохранить"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
