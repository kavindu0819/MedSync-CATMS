import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, checkBackend, fetchReport } from "./api";

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

  const moneyKey = /revenue|amount|total|paid|balance|outstanding|covered|pocket/i.test(key);
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
  const chartRows = demoRows["Branch appointments"];

  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/reports/summary')
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="summary-grid">
        <div className="summary-card"><span>Total patients</span><strong>{stats?.total_patients ?? '—'}</strong><small>From the current seed data</small></div>
        <div className="summary-card"><span>Appointments</span><strong>{stats?.total_appointments?.toLocaleString() ?? '—'}</strong><small>Across three branches</small></div>
        <div className="summary-card"><span>Outstanding</span><strong>LKR {Number(stats?.outstanding_balance ?? 0).toLocaleString()}</strong><small>Demo summary until API is ready</small></div>
        <div className="summary-card"><span>Reports</span><strong>5</strong><small>Available report pages</small></div>
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

function App() {
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
          <div className="user-chip"><span className="user-avatar">S</span><span>Sivakumaran</span></div>
        </header>

        {activeReport === "Overview" ? (
          <Overview backendStatus={backendStatus} onSelectReport={selectReport} />
        ) : (
          <section className="panel report-panel">
            <div className="panel-heading"><div><p className="eyebrow">REPORT RESULTS</p><h3>{activeReport}</h3></div>{usingDemoData && <span className="demo-badge">Demo data</span>}</div>
            <FilterBar reportName={activeReport} values={draftFilters} onChange={updateFilter} onApply={() => setAppliedFilters({ ...draftFilters })} />
            {error && <div className="notice">{error}</div>}
            {loading ? <div className="empty-state">Loading report...</div> : <><ReportChart reportName={activeReport} rows={rows} /><ReportTable rows={rows} /></>}
            <p className="panel-note">The backend teammate must provide the report endpoint before this page can show database data.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
