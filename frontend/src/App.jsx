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
         fetchOutstandingBalances, fetchTreatmentCategories } from "./api";

import "./App.css";

const reportNames = [
  "Overview",
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
  const numericValue = typeof value === "number" ? value : Number(value);
  if (moneyKey && Number.isFinite(numericValue)) {
    return `LKR ${numericValue.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
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
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey={valueKey} fill="#2563eb" radius={[6, 6, 0, 0]} />
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

      <section className="summary-grid">
        <div className="summary-card"><span>Total patients</span><strong>{stats?.total_patients ?? '—'}</strong><small>From the current seed data</small></div>
        <div className="summary-card"><span>Appointments</span><strong>{stats?.total_appointments?.toLocaleString() ?? '—'}</strong><small>Across three branches</small></div>
        <div className="summary-card"><span>Total branches</span><strong>{stats?.total_branches ?? '—'}</strong><small>From current branches in the system</small></div>
        <div className="summary-card"><span>Total doctors</span><strong>{stats?.total_doctors ?? '—'}</strong><small>From the current seed data</small></div>
        <div className="summary-card"><span>Total billed</span><strong>LKR {Number(stats?.total_billed ?? 0).toLocaleString()}</strong><small>Current billing summary</small></div>
        <div className="summary-card"><span>Total paid</span><strong>LKR {Number(stats?.total_collected ?? 0).toLocaleString()}</strong><small>Current collection summary</small></div>
        <div className="summary-card"><span>Outstanding</span><strong>LKR {Number(stats?.outstanding_balance ?? 0).toLocaleString()}</strong><small>Current outstanding balance</small></div>
        {/* <div className="summary-card"><span>Reports</span><strong>5</strong><small>Available report pages</small></div> */}
      </section>

      <section className="overview-grid">
        <div className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">APPOINTMENTS</p><h3>Branch activity</h3></div></div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="branch" /><YAxis /><Tooltip />
              <Bar dataKey="completed" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="scheduled" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cancelled" fill="#f87171" radius={[6, 6, 0, 0]} />
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
          <p className="panel-note">Select a report from the menu. Demo rows are replaced automatically when the backend returns real rows.</p>
          <button className="secondary-button" onClick={() => onSelectReport("Branch appointments")}>Open first report</button>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="#2563eb" />
                <Bar dataKey="scheduled" stackId="a" fill="#93c5fd" />
                <Bar dataKey="cancelled" stackId="a" fill="#f87171" />
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

function TreatmentCategoriesReport() {
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({ from: "", to: "" });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 0, pageSize: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchTreatmentCategories(page, appliedFilters)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((requestError) => {
        if (!cancelled) {
          setData({ rows: [], total: 0, totalPages: 0, pageSize: 100 });
          setError(requestError.response?.data?.error || "Could not load treatment category data from the database.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, appliedFilters]);

  function goToPage(nextPage) {
    setLoading(true);
    setError("");
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyFilters() {
    setLoading(true);
    setError("");
    setPage(1);
    setAppliedFilters(Object.fromEntries(
      Object.entries(draftFilters).filter(([, value]) => value)
    ));
  }

  const first = data.total === 0 ? 0 : (page - 1) * data.pageSize + 1;
  const last = Math.min(page * data.pageSize, data.total);

  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">REPORT RESULTS</p><h3>Treatment categories</h3></div>
      </div>
      <FilterBar
        reportName="Treatment categories"
        values={draftFilters}
        onChange={(field, value) => setDraftFilters((current) => ({ ...current, [field]: value }))}
        onApply={applyFilters}
      />
      {error && <div className="notice">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <>
          <p className="panel-note">
            Showing {first}–{last} of {data.total.toLocaleString()} treatment category records, 100 per page
          </p>
          <ReportChart reportName="Treatment categories" rows={data.rows} />
          <ReportTable rows={data.rows} />
          <Pagination page={data.page || page} totalPages={data.totalPages} onChange={goToPage} />
        </>
      )}
    </section>
  );
}

function App({ user, onLogout }) {
  const navigate = useNavigate();
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
    if (activeReport === "Branch appointments") return;
    if (activeReport === "Outstanding balances") return;

    setLoading(true);
    setError("");
    setUsingDemoData(false);

    try {
      const payload = await fetchReport(activeReport, appliedFilters);
      const apiRows = normaliseRows(payload);
      setRows(apiRows);
    } catch (requestError) {
      // This lets the UI remain usable before the backend teammate finishes the report APIs.
      setRows(demoRows[activeReport] || []);
      setUsingDemoData(true);
      setError(requestError.response?.data?.message || "Report API is not available yet. Showing demo data.");
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon">M</div><div><h1>MedSync</h1><p>CATMS Dashboard</p></div></div>
        <nav className="navigation">
          {reportNames.map((report) => <button key={report} className={activeReport === report ? "nav-item active" : "nav-item"} onClick={() => selectReport(report)}>{report}</button>)}
        </nav>
        <div className="sidebar-footer"><p>Clinic management system</p><span>Frontend v1.0</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">MEDSYNC CATMS</p><h2>{activeReport}</h2></div>
          <div className="user-chip">
            <span className="user-avatar">{(user?.name || "Admin").charAt(0).toUpperCase()}</span>
            <span>{user?.name || "Administrator"}</span>
            <button className="logout-button" type="button" onClick={() => { onLogout(); navigate("/", { replace: true }); }}>Sign out</button>
          </div>
        </header>

        {activeReport === "Overview" ? (
          <Overview backendStatus={backendStatus} onSelectReport={selectReport} />
        ) : activeReport === "Branch appointments" ? (
          <BranchAppointmentsReport />
        ) : activeReport === "Outstanding balances" ? (
          <OutstandingBalancesReport />
        ) : activeReport === "Treatment categories" ? (
          <TreatmentCategoriesReport />
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
