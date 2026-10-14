import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  Legend,
  YAxis,
} from "recharts";
import { api, checkBackend, fetchOverviewSummary, fetchReport,
         fetchBranches, fetchBranchMonths, fetchBranchAppointments,
         fetchOutstandingBalances, fetchInsuranceCoverage, createPatient } from "./api";

import DashboardSidebar from "./DashboardSidebar";
import { useDashboardTheme } from "./useDashboardTheme";
import {
  TAB_ICONS, UsersIcon, CalendarIcon, BuildingIcon,
  StethoscopeIcon, ReceiptIcon, CoinsIcon, ClockIcon, ShieldIcon,
} from "./icons";

import "./App.css";

// Chart colours, matching the green dashboard theme in App.css.
const CHART = {
  completed: "#22b04f",
  scheduled: "#3b8bf6",
  cancelled: "#f2557a",
  single: "#22b04f",
};

const reportNames = [
  "Overview",
  "Patients",
  "Branch appointments",
  "Doctor revenue",
  "Outstanding balances",
  "Treatment categories",
  "Insurance coverage",
];

// The SRS requires these filters. The backend should accept matching query names.
const filterDefinitions = {
  "Branch appointments": ["branch", "date"],
  "Doctor revenue": ["doctor", "from", "to"],
  "Treatment categories": ["from", "to"],
  "Outstanding balances": [],
  "Insurance coverage": [],
};

// Demo rows keep the frontend usable while the backend report routes are being built.
// They are replaced automatically when a report API returns data.
const demoRows = {
  "Branch appointments": [
    { branch: "Colombo", date: "2026-09-25", scheduled: 18, completed: 42, cancelled: 3, total: 63 },
    { branch: "Kandy", date: "2026-09-25", scheduled: 12, completed: 35, cancelled: 2, total: 49 },
    { branch: "Galle", date: "2026-09-25", scheduled: 15, completed: 29, cancelled: 1, total: 45 },
  ],
  "Doctor revenue": [
    { doctor: "Dr. Perera", branch: "Colombo", consultations: 42, treatments: 17, revenue: 142500 },
    { doctor: "Dr. Fernando", branch: "Kandy", consultations: 35, treatments: 9, revenue: 104300 },
    { doctor: "Dr. Silva", branch: "Galle", consultations: 29, treatments: 12, revenue: 96800 },
  ],
  "Outstanding balances": [
    { patient: "W.A. Silva", invoice_id: "INV-00231", total: 8500, paid: 3000, outstanding: 5500 },
    { patient: "K.D. Jayasuriya", invoice_id: "INV-00318", total: 12000, paid: 5000, outstanding: 7000 },
  ],
  "Treatment categories": [
    { category: "Diagnostic", date: "2026-09-25", treatment_count: 61 },
    { category: "Minor Procedure", date: "2026-09-25", treatment_count: 48 },
    { category: "Therapeutic", date: "2026-09-25", treatment_count: 36 },
  ],
  "Insurance coverage": [
    { patient: "K.D. Jayasuriya", invoice_id: "INV-00318", insurance_covered: 5600, out_of_pocket: 1400 },
    { patient: "W.A. Silva", invoice_id: "INV-00231", insurance_covered: 3500, out_of_pocket: 2000 },
  ],
};

function titleCase(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCell(value, key) {
  if (value === null || value === undefined || value === "") return "-";

  const moneyKey = /revenue|amount|total|paid|balance|outstanding|covered|pocket|value/i.test(key);
  if (typeof value === "number" && moneyKey) {
    return `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
  }

  return String(value);
}

function normaliseRows(payload) {
  // Different backend implementations commonly use one of these response shapes.
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function ReportTable({ rows }) {
  const columns = rows.length ? Object.keys(rows[0]) : [];

  if (!rows.length) {
    return <div className="empty-state">No rows were returned for this filter.</div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{titleCase(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column}>{formatCell(row[column], column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportChart({ reportName, rows }) {
  const chartData = useMemo(() => {
    if (reportName === "Branch appointments") {
      return rows.map((row) => ({
        name: row.branch || row.Branch,
        completed: Number(row.completed ?? row.Completed ?? 0),
        scheduled: Number(row.scheduled ?? row.Scheduled ?? 0),
      }));
    }

    if (reportName === "Doctor revenue") {
      return rows.map((row) => ({
        name: row.doctor || row.Doctor,
        revenue: Number(row.revenue ?? row.Revenue ?? 0),
      }));
    }

    if (reportName === "Treatment categories") {
      return rows.map((row) => ({
        name: row.category || row.Category,
        count: Number(row.treatment_count ?? row.TreatmentCount ?? 0),
      }));
    }

    return [];
  }, [reportName, rows]);

  if (!chartData.length) return null;

  const valueKey = reportName === "Branch appointments" ? "completed" : reportName === "Doctor revenue" ? "revenue" : "count";

  return (
    <div className="chart-box">
      <h3>{reportName} chart</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey={valueKey} fill={CHART.single} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FilterBar({ reportName, values, onChange, onApply }) {
  const fields = filterDefinitions[reportName] || [];
  if (!fields.length) return null;

  return (
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      {fields.map((field) => (
        <label key={field}>
          <span>{titleCase(field)}</span>
          {field === "branch" ? (
            <select value={values[field]} onChange={(event) => onChange(field, event.target.value)}>
              <option value="">All branches</option>
              <option value="Colombo">Colombo</option>
              <option value="Kandy">Kandy</option>
              <option value="Galle">Galle</option>
            </select>
          ) : (
            <input
              type={field === "doctor" ? "text" : "date"}
              value={values[field]}
              placeholder={field === "doctor" ? "Doctor ID or name" : "Choose date"}
              onChange={(event) => onChange(field, event.target.value)}
            />
          )}
        </label>
      ))}
      <button className="primary-button" type="submit">Apply filters</button>
    </form>
  );
}

const lkr = (value) => `LKR ${Number(value ?? 0).toLocaleString()}`;

// The Overview cards: what each shows and its colour (tone-* in App.css).
function summaryCards(stats) {
  return [
    { label: "Total patients", value: stats?.total_patients?.toLocaleString() ?? "-", note: "Registered at any branch", tone: "pink", Icon: UsersIcon },
    { label: "Appointments", value: stats?.total_appointments?.toLocaleString() ?? "-", note: "Across all branches", tone: "peach", Icon: CalendarIcon },
    { label: "Branches", value: stats?.total_branches ?? "-", note: "Clinics in the system", tone: "mint", Icon: BuildingIcon },
    { label: "Doctors", value: stats?.total_doctors ?? "-", note: "On the staff list", tone: "lavender", Icon: StethoscopeIcon },
    { label: "Total billed", value: lkr(stats?.total_billed), note: "All invoices", tone: "blue", Icon: ReceiptIcon },
    { label: "Paid by patients", value: lkr(stats?.total_collected), note: "Payments received", tone: "mint", Icon: CoinsIcon },
    { label: "Paid by insurance", value: lkr(stats?.total_insurance), note: "Approved claims", tone: "lavender", Icon: ShieldIcon },
    { label: "Outstanding", value: lkr(stats?.outstanding_balance), note: "Still to be collected", tone: "pink", Icon: ClockIcon },
  ];
}

function Overview({ backendStatus, onSelectReport }) {
  const [chartRows, setChartRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    fetchOverviewSummary()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch summary:", err);
        if (!cancelled) {
          setError("Summary API not available yet.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    api.get('/reports/branch-summary')
      .then((res) => {
        setChartRows(res.data.map((row) => ({
          branch: row.branch,
          completed: Number(row.completed),
          scheduled: Number(row.scheduled),
          cancelled: Number(row.cancelled),
        })));
      })
      .catch((err) => {
        console.error('Failed to fetch branch summary:', err);
        setChartRows(demoRows["Branch appointments"]);
      });
  }, []);

  return (
    <>
      {error && <div className="notice">{error}</div>}
      {loading && !stats ? <div className="empty-state">Loading overview...</div> : null}

      <section className="summary-grid summary-grid--four">
        {summaryCards(stats).map(({ label, value, note, tone, Icon }) => (
          <div key={label} className={`summary-card tone-${tone}`}>
            <span className="summary-icon"><Icon size={22} /></span>
            <div className="summary-text">
              <strong>{value}</strong>
              <span>{label}</span>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="overview-grid">
        <div className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">APPOINTMENTS</p><h3>Branch activity</h3></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="branch" /><YAxis /><Tooltip />
              <Bar dataKey="completed" fill={CHART.completed} radius={[6, 6, 0, 0]} maxBarSize={34} />
              <Bar dataKey="scheduled" fill={CHART.scheduled} radius={[6, 6, 0, 0]} maxBarSize={34} />
              <Bar dataKey="cancelled" fill={CHART.cancelled} radius={[6, 6, 0, 0]} maxBarSize={34} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">CONNECTIONS</p><h3>System status</h3></div></div>
          <div className="status-list">
            <div><span className={`dot ${backendStatus === "connected" ? "green" : "orange"}`}></span><span>Backend API</span><strong>{backendStatus}</strong></div>
            <div><span className="dot orange"></span><span>Report APIs</span><strong>confirm with team</strong></div>
            <div><span className="dot green"></span><span>Frontend</span><strong>running</strong></div>
          </div>
          {onSelectReport ? (
            <>
              <p className="panel-note">Select a report from the menu. Demo rows are replaced automatically when the backend returns real rows.</p>
              <button className="secondary-button" onClick={() => onSelectReport("Branch appointments")}>Open first report</button>
            </>
          ) : (
            <p className="panel-note">Use Patients in the menu to register someone new at the front desk.</p>
          )}
        </div>
      </section>
    </>
  );
}

function monthLabel(month) {
  const [year, mon] = month.split("-");
  return new Date(Number(year), Number(mon) - 1)
    .toLocaleString("en", { month: "long", year: "numeric" });
}

function BranchAppointmentsReport() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBranches()
      .then(setBranches)
      .catch(() => setError("Could not load branches."));
  }, []);

  useEffect(() => {
    setMonths([]);
    if (!branchId) return;
    fetchBranchMonths(branchId)
      .then(setMonths)
      .catch(() => setMonths([]));
  }, [branchId]);

  useEffect(() => {
    if (!branchId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchBranchAppointments(branchId, month)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setError("Could not load appointments."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [branchId, month]);

  const chartData = rows.map((r) => ({
    day: r.date.slice(5),
    completed: Number(r.completed),
    scheduled: Number(r.scheduled),
    cancelled: Number(r.cancelled),
  }));


  return (
    <section className="panel">
      <div className="panel-heading">
        <div><p className="eyebrow">REPORT RESULTS</p><h3>Branch appointments</h3></div>
      </div>

      <div className="filter-bar">
        <label>
          <span>Branch</span>
          <select
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setMonth(""); }}
          >
            <option value="">Select a branch</option>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
            ))}
          </select>
        </label>

        {branchId && (
          <label>
            <span>Period</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Last 30 days</option>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <div className="notice">{error}</div>}

      {!branchId ? (
        <div className="empty-state">Select a branch to see its appointments.</div>
      ) : loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill={CHART.completed} />
                <Bar dataKey="scheduled" stackId="a" fill={CHART.scheduled} />
                <Bar dataKey="cancelled" stackId="a" fill={CHART.cancelled} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ReportTable rows={rows} />
        </>
      )}
    </section>
  );
}

// Which page numbers to show: always the first and last, plus the pages
// either side of the current one, with "…" where pages are skipped.
//   page 1 of 23  ->  1 2 … 23
//   page 6 of 23  ->  1 … 5 6 7 … 23
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);

  return pages;
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pages">
      <button
        type="button"
        className="page-button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Prev
      </button>

      {pageNumbers(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="page-gap">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={p === page ? "page-button active" : "page-button"}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className="page-button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </nav>
  );
}

function OutstandingBalancesReport() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 0, pageSize: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchOutstandingBalances(page)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError("Could not load outstanding balances."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page]);

  function goToPage(p) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const first = data.total === 0 ? 0 : (page - 1) * data.pageSize + 1;
  const last = Math.min(page * data.pageSize, data.total);

  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">REPORT RESULTS</p><h3>Outstanding balances</h3></div>
      </div>

      {error && <div className="notice">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          <p className="panel-note">
            Showing {first}–{last} of {data.total.toLocaleString()} unpaid invoices, largest first
          </p>
          <ReportTable rows={data.rows} />
          <Pagination page={page} totalPages={data.totalPages} onChange={goToPage} />
        </>
      )}
    </section>
  );
}

function InsuranceCoverageReport() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 0, pageSize: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchInsuranceCoverage(page)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError("Could not load insurance coverage."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page]);

  function goToPage(p) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const first = data.total === 0 ? 0 : (page - 1) * data.pageSize + 1;
  const last = Math.min(page * data.pageSize, data.total);

  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">REPORT RESULTS</p><h3>Insurance coverage</h3></div>
      </div>

      {error && <div className="notice">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          <p className="panel-note">
            Showing {first}–{last} of {data.total.toLocaleString()} insurance claims, newest first
          </p>
          <ReportTable rows={data.rows} />
          <Pagination page={page} totalPages={data.totalPages} onChange={goToPage} />
        </>
      )}
    </section>
  );
}

// Same rules as POST /api/patients in server.js, checked here first so staff
// see mistakes before submitting.
const NIC_PATTERN = /^(\d{9}[VvXx]|\d{12})$/;
const PHONE_PATTERN = /^0\d{9}$/;
const EMPTY_PATIENT = {
  nic: "", first_name: "", last_name: "", dob: "", gender: "",
  phone: "", address: "", guardian_nic: "",
};

function validatePatient(form) {
  if (!NIC_PATTERN.test(form.nic.trim())) return "NIC must be 9 digits followed by V or X, or 12 digits.";
  if (!form.first_name.trim() || !form.last_name.trim()) return "First and last name are required.";
  if (!form.dob) return "Date of birth is required.";
  if (new Date(`${form.dob}T00:00:00`) > new Date()) return "Date of birth cannot be in the future.";
  if (!form.gender) return "Please choose a gender.";
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) return "Phone must be 10 digits starting with 0, e.g. 0771234567.";
  if (form.guardian_nic.trim() && !NIC_PATTERN.test(form.guardian_nic.trim())) return "Guardian NIC must be 9 digits followed by V or X, or 12 digits.";
  return "";
}

function AddPatientForm() {
  const [form, setForm] = useState(EMPTY_PATIENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null); // the last patient added, for the success message

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setAdded(null);

    const problem = validatePatient(form);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      const res = await createPatient({
        ...form,
        nic: form.nic.trim().toUpperCase(),
        guardian_nic: form.guardian_nic.trim().toUpperCase(),
      });
      setAdded({
        id: res.patientId,
        name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        nic: form.nic.trim().toUpperCase(),
      });
      setForm(EMPTY_PATIENT);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add the patient. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">FRONT DESK</p><h3>Register a new patient</h3></div>
      </div>
      <p className="panel-note patient-form__intro">
        Add the patient here first. They can then create their own online account on the sign-up page using the same NIC.
      </p>

      {added && (
        <div className="success-notice" role="status">
          <strong>{added.name}</strong> was added as patient #{added.id}. They can now sign up online with NIC <strong>{added.nic}</strong>.
        </div>
      )}
      {error && <div className="notice" role="alert">{error}</div>}

      <form className="filter-bar patient-form" onSubmit={handleSubmit} noValidate>
        <label>
          <span>NIC *</span>
          <input value={form.nic} onChange={(e) => update("nic", e.target.value)} placeholder="200012345678 or 991234567V" autoComplete="off" />
        </label>
        <label>
          <span>First name *</span>
          <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>Last name *</span>
          <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>Date of birth *</span>
          <input type="date" max={today} value={form.dob} onChange={(e) => update("dob", e.target.value)} />
        </label>
        <label>
          <span>Gender *</span>
          <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
            <option value="">Choose…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label>
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0771234567" inputMode="tel" autoComplete="off" />
        </label>
        <label className="patient-form__wide">
          <span>Address</span>
          <input value={form.address} onChange={(e) => update("address", e.target.value)} autoComplete="off" />
        </label>
        <label>
          <span>Guardian NIC (minors)</span>
          <input value={form.guardian_nic} onChange={(e) => update("guardian_nic", e.target.value)} autoComplete="off" />
        </label>
        <div className="patient-form__actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add patient"}
          </button>
        </div>
      </form>
    </section>
  );
}

// Which sidebar tabs each role sees. The backend enforces the same split.
const TABS_BY_ROLE = {
  ADMIN: reportNames,
  FRONTDESK: ["Overview", "Patients"],
};

function App({ user, role, onLogout }) {
  const navigate = useNavigate();
  const [theme, changeTheme] = useDashboardTheme();
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.ADMIN;
  const isFrontDesk = role === "FRONTDESK";
  const [activeReport, setActiveReport] = useState("Overview");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});

  useEffect(() => {
    checkBackend()
      .then(() => setBackendStatus("connected"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  const loadReport = useCallback(async () => {
    if (activeReport === "Overview") return;
    if (activeReport === "Patients") return;
    if (activeReport === "Branch appointments") return;
    if (activeReport === "Outstanding balances") return;
    if (activeReport === "Insurance coverage") return;

    setLoading(true);
    setError("");
    setUsingDemoData(false);

    try {
      const payload = await fetchReport(activeReport, appliedFilters);
      const apiRows = normaliseRows(payload);
      setRows(apiRows);
    } catch (requestError) {
      if (activeReport === "Treatment categories") {
        setRows([]);
        setUsingDemoData(false);
        setError(requestError.response?.data?.message || requestError.response?.data?.error || "Could not load treatment category data from the database.");
      } else {
        // This lets the UI remain usable before the backend teammate finishes the report APIs.
        setRows(demoRows[activeReport] || []);
        setUsingDemoData(true);
        setError(requestError.response?.data?.message || "Report API is not available yet. Showing demo data.");
      }
    } finally {
      setLoading(false);
    }
  }, [activeReport, appliedFilters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function selectReport(reportName) {
    setActiveReport(reportName);
    setDraftFilters({});
    setAppliedFilters({});
  }

  function updateFilter(field, value) {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <DashboardSidebar
        subtitle="CATMS Dashboard"
        navLabel="Dashboard navigation"
        items={tabs.map((tab) => ({ id: tab, label: tab, Icon: TAB_ICONS[tab] }))}
        active={activeReport}
        onSelect={selectReport}
        theme={theme}
        onThemeChange={changeTheme}
        userName={user?.name || "Administrator"}
        userRole={isFrontDesk ? "Front desk" : "Administrator"}
        onSignOut={() => { onLogout(); navigate("/", { replace: true }); }}
      />

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">MEDSYNC CATMS</p><h2>{activeReport}</h2></div>
        </header>

        {activeReport === "Overview" ? (
          <Overview backendStatus={backendStatus} onSelectReport={isFrontDesk ? undefined : selectReport} />
        ) : activeReport === "Patients" ? (
          <AddPatientForm />
        ) : activeReport === "Branch appointments" ? (
          <BranchAppointmentsReport />
        ) : activeReport === "Outstanding balances" ? (
          <OutstandingBalancesReport />
        ) : activeReport === "Insurance coverage" ? (
          <InsuranceCoverageReport />
        ) : (
          <section className="panel report-panel">
            <div className="panel-heading"><div><p className="eyebrow">REPORT RESULTS</p><h3>{activeReport}</h3></div>{usingDemoData && <span className="demo-badge">Demo data</span>}</div>
            <FilterBar reportName={activeReport} values={draftFilters} onChange={updateFilter} onApply={() => setAppliedFilters({ ...draftFilters })} />
            {error && <div className="notice">{error}</div>}
            {loading ? <div className="empty-state">Loading report...</div> : <><ReportChart reportName={activeReport} rows={rows} /><ReportTable rows={rows} /></>}
            <p className="panel-note"></p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
