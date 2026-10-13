import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import { useDashboardTheme } from "./useDashboardTheme";
import { completeDoctorAppointment, fetchDoctorAppointments } from "./api";
import { DashboardIcon } from "./icons";
import "./App.css";
// Reuses the patient dashboard's appointment list and filter styles (.pd .appt…).
import "./PatientDashboard.css";

// Doctor's dashboard (role DOCTOR, route /doctor in main.jsx).
const NAV = [{ id: "overview", label: "Overview", Icon: DashboardIcon }];

const SCOPES = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

const EMPTY_MESSAGE = {
  today: "You have no appointments today.",
  upcoming: "You have no upcoming appointments.",
  past: "No past appointments found.",
};

// "2026-10-14" -> { day: "14", month: "OCT", year: "2026" }
function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    day: String(day),
    month: date.toLocaleString("en", { month: "short" }).toUpperCase(),
    year: String(year),
  };
}

// Same rule as the server: only a Scheduled appointment that has already started.
function canComplete(a) {
  return a.status === "Scheduled" && new Date(`${a.date}T${a.start}`) <= new Date();
}

function AppointmentList({ scope }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);       // appointment being saved
  const [actionError, setActionError] = useState(""); // a failed "Mark completed"

  // No reset needed here: the parent gives this list key={scope}, so React
  // starts a fresh list (loading = true) whenever the scope button changes.
  useEffect(() => {
    let cancelled = false;

    fetchDoctorAppointments(scope)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || "Could not load your appointments."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [scope]);

  async function markCompleted(id) {
    setBusyId(id);
    setActionError("");
    try {
      await completeDoctorAppointment(id);
      // Update just this row instead of reloading the whole list.
      setRows((current) => current.map((a) => (a.appointment_id === id ? { ...a, status: "Completed" } : a)));
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not update the appointment. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="empty-state">Loading appointments…</div>;
  if (error) return <div className="notice" role="alert">{error}</div>;
  if (!rows.length) return <div className="empty-state">{EMPTY_MESSAGE[scope]}</div>;

  return (
    <>
      {actionError && <div className="notice" role="alert">{actionError}</div>}
      <ul className="appts">
        {rows.map((a) => {
          const { day, month, year } = dateParts(a.date);
          return (
            <li key={a.appointment_id} className="appt">
              <div className="appt__date">
                <div className="appt__day">{day}</div>
                <div className="appt__month">{month}</div>
                <div className="appt__year">{year}</div>
              </div>
              <div className="appt__info">
                <div className="appt__doctor">{a.patient}</div>
                <div className="appt__meta">
                  {a.branch} · {a.status}{a.is_walkin ? " · Walk-in" : ""}
                </div>
              </div>
              <div className="appt__time">{a.start} – {a.end}</div>
              {canComplete(a) && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyId !== null}
                  onClick={() => markCompleted(a.appointment_id)}
                >
                  {busyId === a.appointment_id ? "Saving…" : "Mark completed"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function DoctorDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [theme, changeTheme] = useDashboardTheme();
  const [scope, setScope] = useState("today");
  const name = user?.name || "Doctor";

  return (
    <div className="app-shell pd" data-theme={theme}>
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
            <div><p className="eyebrow">MY APPOINTMENTS</p><h3>Good to see you, Dr. {name}</h3></div>
          </div>

          <div className="appointment-filters" role="group" aria-label="Which appointments">
            {SCOPES.map((s) => (
              <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <AppointmentList key={scope} scope={scope} />
        </section>
      </main>
    </div>
  );
}
