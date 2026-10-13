import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  bookAppointment,
  fetchAppointmentAvailability,
  fetchBranches,
  fetchDoctorsByBranch,
} from "./api";
import "./PatientDashboard.css";
import { getSession } from "./auth";

const EMPTY_DATA = {
  patient: { name: "" },
  stats: {
    nextAppointment: { date: "None", detail: "No upcoming appointments scheduled" },
    upcomingCount: 0,
    activePrescriptions: null,
    totalVisits: 0,
  },
  billing: { billed: 0, paid: 0, outstanding: 0 },
  appointments: [],
  records: [],
  visitsPerMonth: [],
  bills: [],
  insurance: { provider: "None", status: "Inactive", renews: "N/A", used: 0, limit: 0 },
};

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "appointments", label: "My appointments" },
  { id: "records", label: "Medical records" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "billing", label: "Billing and payments" },
  { id: "insurance", label: "Insurance coverage" },
];

const lkr = (n) => `LKR ${Number(n).toLocaleString("en-US")}`;
const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const STATUS_CLASS = { Paid: "chip chip--paid", "Partly paid": "chip chip--partial", Unpaid: "chip chip--unpaid" };

function StatCard({ label, value, note, highlight }) {
  return (
    <div className={`card stat${highlight ? " stat--highlight" : ""}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      <div className={`stat__note${highlight ? " stat__note--warn" : ""}`}>{note}</div>
    </div>
  );
}

function Panel({ id, eyebrow, title, action, children }) {
  return (
    <section id={id} className="card panel">
      <div className="panel__head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="panel__title">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BookingDialog({ patientId, onClose, onBooked }) {
  const [branches, setBranches] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchBranches()
      .then((rows) => {
        if (!cancelled) setBranches(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load branches. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadSlots = async (nextBranchId, nextDoctorId, nextDate) => {
    setStart("");
    setSlots([]);
    if (!nextBranchId || !nextDoctorId || !nextDate) return;

    setError("");
    setLoadingSlots(true);
    try {
      const rows = await fetchAppointmentAvailability(nextBranchId, nextDoctorId, nextDate);
      setSlots(rows);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load available time slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBranchChange = async (event) => {
    const nextBranchId = event.target.value;
    setBranchId(nextBranchId);
    setDoctorId("");
    setDoctors([]);
    setDate("");
    setStart("");
    setSlots([]);
    setError("");

    if (!nextBranchId) return;
    setLoadingDoctors(true);
    try {
      setDoctors(await fetchDoctorsByBranch(nextBranchId));
    } catch {
      setError("Could not load doctors for this branch.");
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleDoctorChange = (event) => {
    const nextDoctorId = event.target.value;
    setDoctorId(nextDoctorId);
    loadSlots(branchId, nextDoctorId, date);
  };

  const handleDateChange = (event) => {
    const nextDate = event.target.value;
    setDate(nextDate);
    loadSlots(branchId, doctorId, nextDate);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!branchId || !doctorId || !date || !start) {
      setError("Choose a branch, doctor, date and available time slot.");
      return;
    }

    setBusy(true);
    try {
      const result = await bookAppointment({ patientId, branchId, doctorId, date, start });
      onBooked(result);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to book the appointment. Please try another slot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="booking-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal__card" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="booking-modal__head">
          <div>
            <div className="eyebrow">NEW APPOINTMENT</div>
            <h2 id="booking-title">Book a clinic visit</h2>
            <p>Select any MedSync branch. Doctors and available times update automatically.</p>
          </div>
          <button className="booking-modal__close" type="button" onClick={onClose} aria-label="Close booking form">×</button>
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          <label>
            <span>Branch</span>
            <select value={branchId} onChange={handleBranchChange} disabled={loadingBranches || busy} required>
              <option value="">{loadingBranches ? "Loading branches…" : "Select a branch"}</option>
              {branches.map((branch) => (
                <option key={branch.branch_id} value={branch.branch_id}>{branch.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Doctor</span>
            <select value={doctorId} onChange={handleDoctorChange} disabled={!branchId || loadingDoctors || busy} required>
              <option value="">{loadingDoctors ? "Loading doctors…" : branchId ? "Select a doctor" : "Select a branch first"}</option>
              {doctors.map((doctor) => (
                <option key={doctor.doctor_id} value={doctor.doctor_id}>
                  Dr. {doctor.doctor_name} — {doctor.specialties}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Date</span>
            <input type="date" min={todayLocal()} value={date} onChange={handleDateChange} disabled={!doctorId || busy} required />
          </label>

          <label>
            <span>Available time</span>
            <select value={start} onChange={(event) => setStart(event.target.value)} disabled={!date || loadingSlots || busy} required>
              <option value="">
                {loadingSlots ? "Checking availability…" : !date ? "Select a date first" : slots.length ? "Select a time" : "No slots available"}
              </option>
              {slots.map((slot) => (
                <option key={slot.start} value={slot.start}>{slot.start} – {slot.end}</option>
              ))}
            </select>
          </label>

          <div className="booking-form__note">
            The patient account is not tied to one branch. Each appointment stores its own branch and doctor.
          </div>

          {error && <div className="booking-form__error" role="alert">{error}</div>}

          <div className="booking-form__actions">
            <button className="btn btn--secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn" type="submit" disabled={busy || !slots.length}>{busy ? "Booking…" : "Confirm appointment"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AppointmentDetails({ appointment: a, onClose, onCancelled }) {
  const dialog = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current.showModal(); }, []);
  async function cancel() {
    setBusy(true); setError("");
    try {
      await api.patch(`/patient/appointments/${a.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${getSession()?.token || ""}` },
      });
      onCancelled();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to cancel. Please try again.");
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="appointment-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="appointment-title">
    <div className="booking-modal__head"><div><div className="eyebrow">APPOINTMENT #{a.id}</div><h2 id="appointment-title">Your clinic visit</h2></div><button type="button" className="booking-modal__close" onClick={onClose} disabled={busy} aria-label="Close appointment details">×</button></div>
    <dl className="appointment-details">
      <div><dt>Doctor</dt><dd>{a.doctor}</dd></div><div><dt>Specialty</dt><dd>{a.dept}</dd></div>
      <div><dt>Branch</dt><dd>{a.branch}</dd></div><div><dt>Date</dt><dd>{formatDate(a.date)}</dd></div>
      <div><dt>Time</dt><dd>{a.start || a.time}{a.end ? ` – ${a.end}` : ""} (Sri Lanka)</dd></div>
      <div><dt>Status</dt><dd>{a.status}</dd></div><div><dt>Visit type</dt><dd>{a.walkIn ? "Walk-in" : "Booked appointment"}</dd></div>
    </dl>
    {error && <p role="alert" className="booking-form__error">{error}</p>}
    {confirming ? <div className="cancel-confirm"><p>Cancel this appointment? Your reserved time will become available to other patients.</p><div className="booking-form__actions"><button className="btn btn--secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep appointment</button><button className="btn btn--danger" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Yes, cancel appointment"}</button></div></div>
      : <div className="booking-form__actions"><button className="btn btn--secondary" onClick={onClose}>Close</button>{a.canCancel && <button className="btn btn--danger" onClick={() => setConfirming(true)}>Cancel appointment</button>}</div>}
    {!a.canCancel && <p className="muted">Only future, scheduled appointments can be cancelled.</p>}
  </dialog>;
}

export default function PatientDashboard({ patientId, patientName, onLogout }) {
  const navigate = useNavigate();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentFilter, setAppointmentFilter] = useState("upcoming");
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("medsync-admin-theme") === "light" ? "light" : "dark"; } catch { return "dark"; } });
  function changeTheme(value) { setTheme(value); try { localStorage.setItem("medsync-admin-theme", value); } catch { /* Session-only preference. */ } }
  const [active, setActive] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [appointmentNotice, setAppointmentNotice] = useState("");
  const [dashboardState, setDashboardState] = useState({
    patientId: null,
    status: "loading",
    data: EMPTY_DATA,
    error: "",
  });

  useEffect(() => {
    let isMounted = true;

    Promise.resolve()
      .then(() => {
        if (!patientId) {
          throw new Error("Your patient account could not be identified. Please sign in again.");
        }
        return api.get(`/patients/${patientId}/dashboard`);
      })
      .then((res) => {
        if (isMounted && res.data?.success) {
          const responseData = res.data;
          setDashboardState({
            patientId,
            status: "loaded",
            data: {
              ...EMPTY_DATA,
              ...responseData,
              patient: { ...EMPTY_DATA.patient, ...responseData.patient },
              stats: {
                ...EMPTY_DATA.stats,
                ...responseData.stats,
                nextAppointment: {
                  ...EMPTY_DATA.stats.nextAppointment,
                  ...responseData.stats?.nextAppointment,
                },
              },
              billing: { ...EMPTY_DATA.billing, ...responseData.billing },
              appointments: Array.isArray(responseData.appointments) ? responseData.appointments : [],
              records: Array.isArray(responseData.records) ? responseData.records : [],
              visitsPerMonth: Array.isArray(responseData.visitsPerMonth) ? responseData.visitsPerMonth : [],
              bills: Array.isArray(responseData.bills) ? responseData.bills : [],
              insurance: { ...EMPTY_DATA.insurance, ...responseData.insurance },
            },
            error: "",
          });
        } else if (isMounted) {
          setDashboardState({ patientId, status: "error", data: EMPTY_DATA, error: "The patient dashboard returned an invalid response." });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setDashboardState({
            patientId,
            status: "error",
            data: EMPTY_DATA,
            error: err.response?.data?.message || err.message || "Unable to load your patient records. Please try again.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [patientId, refreshKey]);

  const currentState = dashboardState.patientId === patientId ? dashboardState : null;
  const data = currentState?.data || EMPTY_DATA;
  const loading = !currentState || currentState.status === "loading";
  const loadError = currentState?.status === "error" ? currentState.error : "";

  const maxVisits = useMemo(() => Math.max(1, ...data.visitsPerMonth.map((v) => v.count)), [data.visitsPerMonth]);
  const usedPct = data.insurance.limit > 0 ? Math.min(100, Math.round((data.insurance.used / data.insurance.limit) * 100)) : 0;
  const activeItem = NAV.find((item) => item.id === active) || NAV[0];

  const selectPage = (id) => {
    setActive(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBooked = (result) => {
    const appointment = result?.appointment;
    setAppointmentNotice(
      appointment
        ? `Appointment booked at ${appointment.branch_name} with Dr. ${appointment.doctor_name} on ${formatDate(appointment.appointment_date)} at ${String(appointment.scheduled_start).slice(0, 5)}.`
        : "Appointment booked successfully."
    );
    setBookingOpen(false);
    setActive("appointments");
    setRefreshKey((value) => value + 1);
  };

  const openBooking = () => {
    setAppointmentNotice("");
    setBookingOpen(true);
  };

  const renderOverview = () => (
    <div className="pd__page">
      <div className="grid">
        <StatCard label="Next appointment" value={data.stats.nextAppointment.date} note={data.stats.nextAppointment.detail} />
        <StatCard label="Upcoming appointments" value={data.stats.upcomingCount} note="Scheduled visits ahead" />
        <StatCard label="Active prescriptions" value={data.stats.activePrescriptions ?? "N/A"} note="Medication records summary" />
        <StatCard label="Total visits" value={data.stats.totalVisits} note="Across all branches" />
      </div>

      <div className="grid grid--3">
        <StatCard label="Total billed" value={lkr(data.billing.billed)} note="Your billing summary" />
        <StatCard label="Total paid" value={lkr(data.billing.paid)} note="Payments received" />
        <StatCard label="Outstanding balance" value={lkr(data.billing.outstanding)} note="Current amount due" highlight />
      </div>

      <div className="pd__overview-row">
        <Panel eyebrow="ACTIVITY" title="Visits per month">
          {data.visitsPerMonth.length ? (
            <div className="bars" role="img" aria-label="Visits per month bar chart">
              {data.visitsPerMonth.map((v) => (
                <div key={v.month} className="bars__col">
                  <div className="bars__count">{v.count}</div>
                  <div className="bars__bar" style={{ height: `${(v.count / maxVisits) * 140}px` }} />
                  <div className="bars__label">{v.month}</div>
                </div>
              ))}
            </div>
          ) : <p className="muted">No visit activity is available yet.</p>}
        </Panel>

        <Panel eyebrow="QUICK ACCESS" title="Patient services">
          <div className="pd__quick-actions">
            <button type="button" onClick={() => selectPage("appointments")}><strong>Appointments</strong><span>View visits or book a new appointment</span></button>
            <button type="button" onClick={() => selectPage("records")}><strong>Medical records</strong><span>Review consultation history</span></button>
            <button type="button" onClick={() => selectPage("billing")}><strong>Billing</strong><span>Check bills and outstanding balance</span></button>
          </div>
        </Panel>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="pd__page">
      <Panel
        eyebrow="APPOINTMENTS"
        title="My appointments"
        action={<button type="button" className="btn" onClick={openBooking}>Book appointment</button>}
      >
        <p className="pd__section-intro">View appointments across every MedSync branch or create a new booking at the branch that suits you.</p>
        <div className="appointment-filters" role="group" aria-label="Filter appointments">{["upcoming", "history", "all"].map(value => <button type="button" key={value} aria-pressed={appointmentFilter === value} onClick={() => setAppointmentFilter(value)}>{value === "upcoming" ? "Upcoming" : value === "history" ? "Past & cancelled" : "All visits"}</button>)}</div>
        <ul className="appts">
          {data.appointments.filter(a => appointmentFilter === "all" || (appointmentFilter === "upcoming" ? a.canCancel : !a.canCancel)).length === 0 && <li className="muted">No appointment records found.</li>}
          {data.appointments.filter(a => appointmentFilter === "all" || (appointmentFilter === "upcoming" ? a.canCancel : !a.canCancel)).map((a) => (
            <li key={a.id} className="appt">
              <div className="appt__date">
                <div className="appt__day">{a.day}</div>
                <div className="appt__month">{a.month}</div>
                <div className="appt__year">{a.year}</div>
              </div>
              <div className="appt__info">
                <div className="appt__doctor">{a.doctor}</div>
                <div className="appt__meta">{a.dept} · {a.branch} · {a.status}</div>
              </div>
              <div className="appt__time">{a.time}</div><button type="button" className="btn btn--secondary" onClick={() => setSelectedAppointment(a)} aria-label={`View appointment ${a.id} with ${a.doctor}`}>View details</button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );

  const renderRecords = () => (
    <div className="pd__page">
      <Panel eyebrow="MEDICAL RECORDS" title="Consultation history">
        {data.records.length === 0 ? (
          <p className="muted">No consultation records are available for this patient.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Diagnosis</th><th>Doctor</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.date)}</td>
                    <td className="strong">{record.diagnosis}</td>
                    <td>{record.doctor}</td>
                    <td>{record.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );

  const renderPrescriptions = () => (
    <div className="pd__page">
      <Panel eyebrow="PRESCRIPTIONS" title="Prescription records">
        <div className="pd__empty-feature">
          <div className="pd__empty-icon">Rx</div>
          <div>
            <h3>Prescription details are not stored yet</h3>
            <p>Contact your clinic for current medication instructions. This page is kept separate so prescription data can be added later without crowding the dashboard.</p>
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderBilling = () => (
    <div className="pd__page">
      <div className="grid grid--3">
        <StatCard label="Total billed" value={lkr(data.billing.billed)} note="All recorded charges" />
        <StatCard label="Total paid" value={lkr(data.billing.paid)} note="Payments received" />
        <StatCard label="Outstanding balance" value={lkr(data.billing.outstanding)} note="Current amount due" highlight />
      </div>
      <Panel eyebrow="BILLING" title="Bills and payments">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Treatment</th><th className="right">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.bills.length === 0 && <tr><td colSpan="4" className="muted">No bills recorded.</td></tr>}
              {data.bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{formatDate(bill.date)}</td>
                  <td className="strong">{bill.treatment}</td>
                  <td className="right">{lkr(bill.amount)}</td>
                  <td><span className={STATUS_CLASS[bill.status] || "chip"}>{bill.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );

  const renderInsurance = () => (
    <div className="pd__page pd__insurance-page">
      <Panel eyebrow="COVERAGE" title="Insurance coverage">
        <div className="pd__insurance-layout">
          <div className="meter">
            <div className="meter__row"><span>Annual limit used</span><strong>{usedPct}%</strong></div>
            <div className="meter__track"><div className="meter__fill" style={{ width: `${usedPct}%` }} /></div>
            <div className="muted">{lkr(data.insurance.used)} of {lkr(data.insurance.limit)} used</div>
          </div>
          <dl className="facts">
            <div><dt>Provider</dt><dd>{data.insurance.provider}</dd></div>
            <div><dt>Policy status</dt><dd className="ok">{data.insurance.status}</dd></div>
            <div><dt>Renews</dt><dd>{data.insurance.renews}</dd></div>
          </dl>
        </div>
      </Panel>
    </div>
  );

  const renderActivePage = () => {
    if (active === "appointments") return renderAppointments();
    if (active === "records") return renderRecords();
    if (active === "prescriptions") return renderPrescriptions();
    if (active === "billing") return renderBilling();
    if (active === "insurance") return renderInsurance();
    return renderOverview();
  };

  return (
    <div className="pd" data-theme={theme}>
      <aside className="pd__side">
        <div className="brand">
          <div className="brand__logo">M</div>
          <div>
            <div className="brand__name">MedSync</div>
            <div className="brand__sub">Patient Portal</div>
          </div>
        </div>

        <nav className="nav" aria-label="Patient navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPage(item.id)}
              className={`nav__link${active === item.id ? " nav__link--active" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pd__side-footer">
          <p>Secure patient access</p>
          <span>MedSync CATMS</span>
        </div>
      </aside>

      <main className="pd__main">
        <header className="topbar">
          <div>
            <div className="eyebrow">MEDSYNC CATMS</div>
            <h1 className="topbar__title">{activeItem.label}</h1>
          </div>
          <div className="pd__user-actions">
            <div className="pd-theme-switch" role="group" aria-label="Dashboard appearance">{["light", "dark"].map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => changeTheme(value)}>{value === "light" ? "Light" : "Dark"}</button>)}</div>
            <div className="user">
              <div className="user__avatar">{(patientName || data.patient.name || "P").charAt(0).toUpperCase()}</div>
              <div className="user__name">{patientName || data.patient.name || "Patient"}</div>
            </div>
            <button className="pd__logout" type="button" onClick={() => { onLogout(); navigate("/", { replace: true }); }}>Sign out</button>
          </div>
        </header>

        {appointmentNotice && <div className="pd__notice" role="status">{appointmentNotice}</div>}
        {loading && <p className="muted" role="status">Loading your patient records…</p>}
        {loadError && <p className="muted" role="alert">{loadError}</p>}
        {!loading && !loadError && renderActivePage()}
      </main>

      {selectedAppointment && <AppointmentDetails appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onCancelled={() => { setSelectedAppointment(null); setAppointmentNotice("Appointment cancelled. Your appointment list and totals have been refreshed."); setRefreshKey(value => value + 1); }} />}
      {bookingOpen && (
        <BookingDialog
          patientId={patientId}
          onClose={() => setBookingOpen(false)}
          onBooked={handleBooked}
        />
      )}
    </div>
  );
}
