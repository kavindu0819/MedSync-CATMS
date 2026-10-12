import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import "./PatientDashboard.css";


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
const STATUS_CLASS = { "Paid": "chip chip--paid", "Partly paid": "chip chip--partial", "Unpaid": "chip chip--unpaid" };

/* ---------- Small building blocks ---------- */
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

/* ---------- Page ---------- */
export default function PatientDashboard({ patientId, patientName, onLogout }) {
  const navigate = useNavigate();
  const [active, setActive] = useState("overview");
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
          setDashboardState({
            patientId,
            status: "error",
            data: EMPTY_DATA,
            error: "The patient dashboard returned an invalid response.",
          });
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
  }, [patientId]);

  const currentState = dashboardState.patientId === patientId ? dashboardState : null;
  const data = currentState?.data || EMPTY_DATA;
  const loading = !currentState || currentState.status === "loading";
  const loadError = currentState?.status === "error" ? currentState.error : "";

  const maxVisits = useMemo(
    () => Math.max(1, ...data.visitsPerMonth.map((v) => v.count)),
    [data.visitsPerMonth]
  );
  const usedPct = data.insurance.limit > 0
    ? Math.min(100, Math.round((data.insurance.used / data.insurance.limit) * 100))
    : 0;

  const go = (id) => (e) => {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="pd">
      {/* Sidebar */}
      <aside className="pd__side">
        <div className="brand">
          <div className="brand__logo">M</div>
          <div>
            <div className="brand__name">MedSync</div>
            <div className="brand__sub">Patient portal</div>
          </div>
        </div>
        <nav className="nav" aria-label="Patient navigation">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={go(item.id)}
              className={`nav__link${active === item.id ? " nav__link--active" : ""}`}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="pd__main" id="overview">
        <header className="topbar">
          <div>
            <div className="eyebrow">MEDSYNC CATMS</div>
            <h1 className="topbar__title">My health overview</h1>
          </div>
          <div className="pd__user-actions">
            <div className="user">
              <div className="user__avatar">{(patientName || data.patient.name || "P").charAt(0).toUpperCase()}</div>
              <div className="user__name">{patientName || data.patient.name || "Patient"}</div>
            </div>
            <button className="pd__logout" type="button" onClick={() => { onLogout(); navigate("/", { replace: true }); }}>Sign out</button>
          </div>
        </header>

        {loading && <p className="muted" role="status">Loading your patient records…</p>}
        {loadError && <p className="muted" role="alert">{loadError}</p>}

        {!loading && !loadError && <>
        {/* Stat cards */}
        <div className="grid">
          <StatCard label="Next appointment" value={data.stats.nextAppointment.date} note={data.stats.nextAppointment.detail} />
          <StatCard label="Upcoming appointments" value={data.stats.upcomingCount} note="Scheduled visits ahead" />
          <StatCard label="Active prescriptions" value={data.stats.activePrescriptions ?? "N/A"} note="Not tracked in the current system" />
          <StatCard label="Total visits" value={data.stats.totalVisits} note="Across all branches" />
        </div>
        <div className="grid grid--3">
          <StatCard label="Total billed" value={lkr(data.billing.billed)} note="Your billing summary" />
          <StatCard label="Total paid" value={lkr(data.billing.paid)} note="Payments received" />
          <StatCard label="Outstanding balance" value={lkr(data.billing.outstanding)} note="Due before your next visit" highlight />
        </div>

        {/* Appointments + chart */}
        <div className="row">
          <Panel
            id="appointments"
            eyebrow="APPOINTMENTS"
            title="Recent appointments"
            action={<button type="button" className="btn">Book appointment</button>}
          >
            <ul className="appts">
              {data.appointments.length === 0 && <li className="muted">No appointment records found.</li>}
              {data.appointments.map((a) => (
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
                  <div className="appt__time">{a.time}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel eyebrow="ACTIVITY" title="Visits per month">
            <div className="bars" role="img" aria-label="Visits per month bar chart">
              {data.visitsPerMonth.map((v) => (
                <div key={v.month} className="bars__col">
                  <div className="bars__count">{v.count}</div>
                  <div className="bars__bar" style={{ height: `${(v.count / maxVisits) * 140}px` }} />
                  <div className="bars__label">{v.month}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel id="records" eyebrow="MEDICAL RECORDS" title="Consultation history">
          {data.records.length === 0 ? (
            <p className="muted">No consultation records are available for this patient.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Diagnosis</th>
                    <th>Doctor</th>
                    <th>Notes</th>
                  </tr>
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

        <Panel id="prescriptions" eyebrow="PRESCRIPTIONS" title="Prescription records">
          <p className="muted">
            Prescription details are not stored in the current system. Contact your clinic for medication instructions.
          </p>
        </Panel>

        {/* Bills + insurance */}
        <div className="row">
          <Panel id="billing" eyebrow="BILLING" title="Recent bills">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Treatment</th>
                    <th className="right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.length === 0 && (
                    <tr><td colSpan="4" className="muted">No bills recorded.</td></tr>
                  )}
                  {data.bills.map((b) => (
                    <tr key={b.id}>
                      <td>{formatDate(b.date)}</td>
                      <td className="strong">{b.treatment}</td>
                      <td className="right">{lkr(b.amount)}</td>
                      <td><span className={STATUS_CLASS[b.status] || "chip"}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel id="insurance" eyebrow="COVERAGE" title="Insurance coverage">
            <div className="meter">
              <div className="meter__row">
                <span>Annual limit used</span>
                <strong>{usedPct}%</strong>
              </div>
              <div className="meter__track">
                <div className="meter__fill" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="muted">{lkr(data.insurance.used)} of {lkr(data.insurance.limit)} used</div>
            </div>
            <dl className="facts">
              <div><dt>Provider</dt><dd>{data.insurance.provider}</dd></div>
              <div><dt>Policy status</dt><dd className="ok">{data.insurance.status}</dd></div>
              <div><dt>Renews</dt><dd>{data.insurance.renews}</dd></div>
            </dl>
          </Panel>
        </div>

        </>}
      </main>
    </div>
  );
}
