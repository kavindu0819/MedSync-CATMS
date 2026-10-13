import { LogoutIcon, MoonIcon, SunIcon } from "./icons";

// The left sidebar used by every dashboard (admin, front desk, patient).
// Styles are in App.css (.sidebar, .nav-item, .sidebar-account).
//   items: [{ id, label, Icon }]
export default function DashboardSidebar({
  subtitle, items, active, onSelect, theme, onThemeChange, userName, userRole, onSignOut, navLabel,
}) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon">M</div><div><h1>MedSync</h1><p>{subtitle}</p></div></div>

      <nav className="navigation" aria-label={navLabel}>
        {items.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={active === id ? "nav-item active" : "nav-item"}
            aria-current={active === id ? "page" : undefined}
            onClick={() => onSelect(id)}
          >
            {Icon && <Icon />}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-account">
        <div className="theme-switch" role="group" aria-label="Dashboard appearance">
          <button type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><SunIcon size={15} />Light</button>
          <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><MoonIcon size={15} />Dark</button>
        </div>
        <div className="user-chip">
          <span className="user-avatar">{(userName || "M").charAt(0).toUpperCase()}</span>
          <div className="user-chip__text">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </div>
        </div>
        <button className="nav-item logout-button" type="button" onClick={onSignOut}>
          <LogoutIcon />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
