import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import { useDashboardTheme } from "./useDashboardTheme";
import { completeDoctorAppointment, fetchDoctorAppointments, fetchTreatments } from "./api";
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

const lkr = (n) => `LKR ${Number(n).toLocaleString("en-US")}`;

// Pick the treatments done at this visit; saving completes it and creates the bill.
function BillingDialog({ appointment, onClose, onBilled }) {
  const dialog = useRef(null);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    let cancelled = false;
    fetchTreatments()
      .then((rows) => { if (!cancelled) setTreatments(rows); })
      .catch(() => { if (!cancelled) setError("Could not load treatments."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function toggle(id) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const total = treatments.filter((t) => chosen.has(t.treatment_id)).reduce((sum, t) => sum + t.price, 0);
  const categories = [...new Set(treatments.map((t) => t.category))];

  async function handleSave() {
    setBusy(true);
    setError("");
    try {
      const result = await completeDoctorAppointment(appointment.appointment_id, [...chosen]);
      onBilled(result);
    } catch (err) {
      setError(err.response?.data?.message || "Could not complete and bill this visit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="appointment-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="billing-title">
      <div className="booking-modal__head">
        <div>
          <div className="eyebrow">APPOINTMENT #{appointment.appointment_id}</div>
          <h2 id="billing-title">Complete &amp; bill</h2>
          <p>{appointment.patient} · {appointment.date} · {appointment.start} – {appointment.end}</p>
        </div>
        <button type="button" className="booking-modal__close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading treatments…</div>
      ) : (
        <div className="treat-list">
          {categories.map((category) => (
            <fieldset key={category} className="treat-list__group">
              <legend>{category}</legend>
              {treatments.filter((t) => t.category === category).map((t) => (
                <label key={t.treatment_id} className="treat-list__item">
                  <input type="checkbox" checked={chosen.has(t.treatment_id)} onChange={() => toggle(t.treatment_id)} disabled={busy} />
                  <span className="treat-list__name">{t.name}</span>
                  {t.is_claimable && <span className="chip chip--paid">Insurance</span>}
                  <span className="treat-list__price">{lkr(t.price)}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}

      <div className="treat-list__total"><span>Bill total</span><strong>{lkr(total)}</strong></div>
      {error && <div className="booking-form__error" role="alert">{error}</div>}
      <div className="booking-form__actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="primary-button" onClick={handleSave} disabled={busy || chosen.size === 0}>
          {busy ? "Saving…" : "Complete & create bill"}
        </button>
      </div>
    </dialog>
  );
}

function AppointmentList({ scope }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState(null);     // appointment in the Complete & bill pop-up
  const [notice, setNotice] = useState("");

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

  function handleBilled(appointment, result) {
    setBilling(null);
    // Update just this row instead of reloading the whole list.
    setRows((current) => current.map((a) => (a.appointment_id === appointment.appointment_id ? { ...a, status: "Completed" } : a)));
    setNotice(`${appointment.patient}'s visit is completed. Bill #${result.invoiceId} created for ${lkr(result.total)}.`);
  }

  if (loading) return <div className="empty-state">Loading appointments…</div>;
  if (error) return <div className="notice" role="alert">{error}</div>;
  if (!rows.length) return <div className="empty-state">{EMPTY_MESSAGE[scope]}</div>;

  return (
    <>
      {notice && <div className="success-notice" role="status">{notice}</div>}
      {billing && (
        <BillingDialog
          appointment={billing}
          onClose={() => setBilling(null)}
          onBilled={(result) => handleBilled(billing, result)}
        />
      )}
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
                  onClick={() => { setNotice(""); setBilling(a); }}
                >
                  Complete &amp; bill
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
