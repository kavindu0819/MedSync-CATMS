import { useNavigate } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import { useDashboardTheme } from "./useDashboardTheme";
import { DashboardIcon } from "./icons";
import "./App.css";

// Doctor's dashboard (role DOCTOR, route /doctor in main.jsx).
// For now it only welcomes the doctor; their appointments come next.
const NAV = [{ id: "overview", label: "Overview", Icon: DashboardIcon }];

export default function DoctorDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [theme, changeTheme] = useDashboardTheme();
  const name = user?.name || "Doctor";

  return (
    <div className="app-shell" data-theme={theme}>
      <DashboardSidebar
        subtitle="Doctor Portal"
        navLabel="Doctor navigation"
        items={NAV}
        active="overview"
        onSelect={() => {}}
        theme={theme}
        onThemeChange={changeTheme}
        userName={`Dr. ${name}`}
        userRole="Doctor"
        onSignOut={() => { onLogout(); navigate("/", { replace: true }); }}
      />

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">MEDSYNC CATMS</p><h2>Overview</h2></div>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">WELCOME</p><h3>Good to see you, Dr. {name}</h3></div>
          </div>
          <p className="panel-note">Your appointments will appear here.</p>
        </section>
      </main>
    </div>
  );
}
