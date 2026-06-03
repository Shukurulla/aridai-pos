import { NavLink, Outlet, useLocation, matchPath } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const NAV = [
  { to: "/", label: "Панель управления", end: true },
  { to: "/features", label: "Функции" },
  { to: "/branches", label: "Филиалы" },
];

function pageTitle(pathname) {
  if (pathname === "/") return "Панель управления";
  if (pathname === "/features") return "Функции (переключение)";
  if (matchPath("/branches/:id", pathname)) return "Филиал";
  if (pathname === "/branches") return "Филиалы";
  return "Панель ресторана";
}

export default function Layout() {
  const { restaurant, logout } = useAuth();
  const location = useLocation();
  const title = pageTitle(location.pathname);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot" /> AridaiPos
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                isActive || (n.to === "/branches" && location.pathname.startsWith("/branches")) ? "active" : ""
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="rest-name">
            {restaurant?.logo && <img src={restaurant.logo} alt="" />}
            {restaurant?.brand || "Ресторан"}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="main-head">
          <h1>{title}</h1>
          <div className="user" style={{ color: "var(--text-dim)", fontSize: 14 }}>
            {restaurant?.owner?.name}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
