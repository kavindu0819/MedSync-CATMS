import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import "./PatientDashboard.css";


/* ---------- Sample data (replaced automatically when the API returns rows) ---------- */
const SAMPLE = {
  patient: { name: "Patient name" },
  stats: {
    nextAppointment: { date: "14 Oct", detail: "Tue, 9:30 AM · Colombo branch" },
    upcomingCount: 3,
    activePrescriptions: 2,
    totalVisits: 18,
  },
  billing: { billed: 96500, paid: 82000, outstanding: 14500 },
  appointments: [
    { id: 1, day: "14", month: "OCT", doctor: "Dr. A. Perera", dept: "Cardiology", branch: "Colombo branch", time: "9:30 AM" },
    { id: 2, day: "21", month: "OCT", doctor: "Dr. S. Fernando", dept: "Dental", branch: "Kandy branch", time: "2:00 PM" },
    { id: 3, day: "03", month: "NOV", doctor: "Dr. N. Jayasuriya", dept: "General medicine", branch: "Colombo branch", time: "11:15 AM" },
  ],
  visitsPerMonth: [
    { month: "May", count: 1 },
    { month: "Jun", count: 2 },
    { month: "Jul", count: 1 },
    { month: "Aug", count: 3 },
    { month: "Sep", count: 2 },
    { month: "Oct", count: 1 },
  ],
  bills: [
    { id: 1, date: "02 Oct 2026", treatment: "Cardiology consult", amount: 14500, status: "Unpaid" },
    { id: 2, date: "18 Sep 2026", treatment: "Blood panel", amount: 9800, status: "Paid" },
    { id: 3, date: "28 Aug 2026", treatment: "Dental cleaning", amount: 22000, status: "Partly paid" },
    { id: 4, date: "11 Aug 2026", treatment: "General checkup", amount: 6500, status: "Paid" },
  ],
  insurance: { provider: "Insurer name", status: "Active", renews: "31 Dec 2026", used: 120000, limit: 300000 },
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
export default function PatientDashboard({ apiBase = "/api", patientId, patientName, onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(SAMPLE);
  const [active, setActive] = useState("overview");
  const [usingSample, setUsingSample] = useState(true);

  // Replace the sample data with real rows when the backend responds.
  useEffect(() => {
    if (!patientId) return;
    let isMounted = true;

    api.get(`/patients/${patientId}/dashboard`)
      .then((res) => {
        if (isMounted && res.data) {
          setData((prev) => ({ ...prev, ...res.data }));
          setUsingSample(false);
        }
      })
      .catch((err) => {
        console.warn("Could not load live patient data, showing demo data:", err.message);
        if (isMounted) setUsingSample(true);
      });

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const maxVisits = useMemo(
    () => Math.max(1, ...data.visitsPerMonth.map((v) => v.count)),
    [data.visitsPerMonth]
  );
  const usedPct = Math.round((data.insurance.used / data.insurance.limit) * 100);

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
              <div className="user__avatar">{(patientName || data.patient.name).charAt(0).toUpperCase()}</div>
              <div className="user__name">{patientName || data.patient.name}</div>
            </div>
            <button className="pd__logout" type="button" onClick={() => { onLogout(); navigate("/", { replace: true }); }}>Sign out</button>
          </div>
        </header>

        {/* Stat cards */}
        <div className="grid">
          <StatCard label="Next appointment" value={data.stats.nextAppointment.date} note={data.stats.nextAppointment.detail} />
          <StatCard label="Upcoming appointments" value={data.stats.upcomingCount} note="Booked for the next 30 days" />
          <StatCard label="Active prescriptions" value={data.stats.activePrescriptions} note="Prescribed by your doctors" />
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
            title="Upcoming visits"
            action={<button type="button" className="btn">Book appointment</button>}
          >
            <ul className="appts">
              {data.appointments.map((a) => (
                <li key={a.id} className="appt">
                  <div className="appt__date">
                    <div className="appt__day">{a.day}</div>
                    <div className="appt__month">{a.month}</div>
                  </div>
                  <div className="appt__info">
                    <div className="appt__doctor">{a.doctor}</div>
                    <div className="appt__meta">{a.dept} · {a.branch}</div>
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
                  {data.bills.map((b) => (
                    <tr key={b.id}>
                      <td>{b.date}</td>
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

        {usingSample && (
          <p className="muted">Sample data shown. Rows are replaced automatically when the backend returns your real records.</p>
        )}
      </main>
    </div>
  );
}
