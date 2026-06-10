import { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { useModal } from "../modal";
import { api } from "../api";
import { Icon } from "../icons";
import Orders from "./Orders";
import Reports from "./Reports";
import Shifts from "./Shifts";
import Categories from "./Categories";
import Foods from "./Foods";
import Tables from "./Tables";
import Sklad from "./Sklad";
import Keshbek from "./Keshbek";
import QrOrders from "./QrOrders";

const NAV = [
  { id: "orders", label: "Заказы", ic: "receipt" },
  { id: "reports", label: "Отчёты", ic: "chart" },
  { id: "shifts", label: "Смена", ic: "clock" },
  { id: "foods", label: "Меню (блюда)", ic: "dish" },
  { id: "categories", label: "Категории", ic: "grid" },
  { id: "tables", label: "Столы и кабины", ic: "chair" },
  { id: "sklad", label: "Склад", ic: "box" },
  { id: "keshbek", label: "Кешбэк", ic: "money" },
  { id: "qrorders", label: "QR заказы", ic: "image" },
];
const SOON = [
  { id: "safe", label: "Сейф", ic: "safe" },
];

const ROLE_RU = { branch_admin: "Администратор филиала", admin: "Администратор", owner: "Владелец" };

export default function Shell() {
  const { user, branchId, logout } = useAuth();
  const dlg = useModal();
  const [page, setPage] = useState("orders");
  const [branchName, setBranchName] = useState("");

  // Filial nomini ishonchli olish — login branch'ni populate qilmaydi (faqat id).
  useEffect(() => {
    let alive = true;
    if (user?.branch?.name) {
      setBranchName(user.branch.name);
      return;
    }
    if (branchId) {
      api.branch(branchId)
        .then((r) => { if (alive && r.data?.name) setBranchName(r.data.name); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [user, branchId]);

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="head">
          <div className="brand" style={{ marginBottom: 0 }}>
            <div className="logo">A</div>
            <div>
              <div className="t1" style={{ fontSize: 16 }}>AridaiPOS</div>
              <div className="t2">Админ филиала</div>
            </div>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${page === n.id ? "active" : ""}`}
            onClick={() => setPage(n.id)}
          >
            <span className="ic"><Icon name={n.ic} /></span> {n.label}
          </button>
        ))}
        {SOON.map((n) => (
          <div key={n.id} className="nav-item soon" title="Скоро">
            <span className="ic"><Icon name={n.ic} /></span> {n.label}
            <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>скоро</span>
          </div>
        ))}
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="tb-title">
            <span className="b">{branchName || "Управление филиалом"}</span>
            <span className="s">Филиал</span>
          </div>
          <div className="tb-right">
            <span className="tb-user">
              <b>{user?.name}</b> · {ROLE_RU[user?.role] || user?.role}
            </span>
            <button
              className="btn btn-sm ghost icon-btn"
              onClick={async () => {
                if (await dlg.confirm({ title: "Выйти из системы?", message: "Вы выйдете из панели администратора.", okText: "Выйти" })) logout();
              }}
            >
              <Icon name="logout" size={16} /> Выйти
            </button>
          </div>
        </div>
        <div className="content">
          {page === "orders" && <Orders />}
          {page === "reports" && <Reports />}
          {page === "shifts" && <Shifts />}
          {page === "foods" && <Foods onBranchName={setBranchName} />}
          {page === "categories" && <Categories />}
          {page === "tables" && <Tables />}
          {page === "sklad" && <Sklad />}
          {page === "keshbek" && <Keshbek />}
          {page === "qrorders" && <QrOrders />}
        </div>
      </div>
    </div>
  );
}
