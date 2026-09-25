import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

// Sidebar report names
const reportNames = [
  "Overview",
  "Branch appointments",
  "Doctor revenue",
  "Outstanding balances",
  "Treatment categories",
  "Insurance coverage",
];

// Temporary sample chart data
const appointmentChart = [
  { branch: "Colombo", completed: 42, scheduled: 18 },
  { branch: "Kandy", completed: 35, scheduled: 12 },
  { branch: "Galle", completed: 29, scheduled: 15 },
];

// Temporary sample table data
const reportData = {
  "Branch appointments": [
    { Branch: "Colombo", Date: "2026-09-25", Scheduled: 18, Completed: 42, Cancelled: 3 },
    { Branch: "Kandy", Date: "2026-09-25", Scheduled: 12, Completed: 35, Cancelled: 2 },
    { Branch: "Galle", Date: "2026-09-25", Scheduled: 15, Completed: 29, Cancelled: 1 },
  ],

  "Doctor revenue": [
    { Doctor: "Dr. Perera", Branch: "Colombo", Consultations: 42, Treatments: 17, Revenue: "LKR 142,500.00" },
    { Doctor: "Dr. Fernando", Branch: "Kandy", Consultations: 35, Treatments: 9, Revenue: "LKR 104,300.00" },
    { Doctor: "Dr. Silva", Branch: "Galle", Consultations: 29, Treatments: 12, Revenue: "LKR 96,800.00" },
  ],

  "Outstanding balances": [
    { Patient: "W.A. Silva", Invoice: "INV-00231", Total: "LKR 8,500.00", Paid: "LKR 3,000.00", Outstanding: "LKR 5,500.00" },
    { Patient: "K.D. Jayasuriya", Invoice: "INV-00318", Total: "LKR 12,000.00", Paid: "LKR 5,000.00", Outstanding: "LKR 7,000.00" },
  ],

  "Treatment categories": [
    { Category: "Diagnostic", Date: "2026-09-25", TreatmentCount: 61 },
    { Category: "Minor Procedure", Date: "2026-09-25", TreatmentCount: 48 },
    { Category: "Therapeutic", Date: "2026-09-25", TreatmentCount: 36 },
  ],

  "Insurance coverage": [
    { Patient: "K.D. Jayasuriya", Invoice: "INV-00318", InsuranceCovered: "LKR 5,600.00", OutOfPocket: "LKR 1,400.00" },
    { Patient: "W.A. Silva", Invoice: "INV-00231", InsuranceCovered: "LKR 3,500.00", OutOfPocket: "LKR 2,000.00" },
  ],
};

function App() {
  // Stores the report currently selected from the sidebar
  const [activeReport, setActiveReport] = useState("Overview");

  // Gets the selected report's rows
  const rows = reportData[activeReport] || [];

  // Gets table headings from the first row
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="app-shell">
      {/* Left navigation sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">M</div>
          <div>
            <h1>MedSync</h1>
            <p>CATMS Dashboard</p>
          </div>
        </div>

        <nav className="navigation">
          {reportNames.map((report) => (
            <button
              key={report}
              className={activeReport === report ? "nav-item active" : "nav-item"}
              onClick={() => setActiveReport(report)}
            >
              {report}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Clinic management system</p>
          <span>Version 1.0</span>
        </div>
      </aside>

      {/* Main dashboard area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">MEDSYNC CATMS</p>
            <h2>{activeReport}</h2>
          </div>

          <div className="user-chip">
            <span className="user-avatar">S</span>
            <span>Sivakumaran</span>
          </div>
        </header>

        {/* Summary cards */}
        <section className="summary-grid">
          <div className="summary-card">
            <span>Total patients</span>
            <strong>300</strong>
            <small>Registered patients</small>
          </div>

          <div className="summary-card">
            <span>Appointments</span>
            <strong>1,200</strong>
            <small>Across 3 branches</small>
          </div>

          <div className="summary-card">
            <span>Outstanding</span>
            <strong>LKR 28,450</strong>
            <small>Pending balances</small>
          </div>

          <div className="summary-card">
            <span>Reports</span>
            <strong>5</strong>
            <small>Available dashboards</small>
          </div>
        </section>

        {/* Overview page */}
        {activeReport === "Overview" && (
          <section className="dashboard-grid">
            <div className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">APPOINTMENTS</p>
                  <h3>Branch appointment activity</h3>
                </div>
                <span className="status-badge">Live data later</span>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={appointmentChart}>
                  <XAxis dataKey="branch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="scheduled" fill="#93c5fd" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SYSTEM STATUS</p>
                  <h3>Today’s overview</h3>
                </div>
              </div>

              <div className="status-list">
                <div>
                  <span className="dot green"></span>
                  <span>Database connection</span>
                  <strong>Ready</strong>
                </div>
                <div>
                  <span className="dot green"></span>
                  <span>Backend API</span>
                  <strong>Ready</strong>
                </div>
                <div>
                  <span className="dot orange"></span>
                  <span>Report endpoints</span>
                  <strong>Pending</strong>
                </div>
              </div>

              <p className="panel-note">
                Sample values are shown now. They will be replaced with backend API data.
              </p>
            </div>
          </section>
        )}

        {/* Selected report table */}
        {activeReport !== "Overview" && (
          <section className="panel report-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">REPORT RESULTS</p>
                <h3>{activeReport}</h3>
              </div>

              <button className="filter-button">Filter report</button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((column) => (
                        <td key={column}>{row[column]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="panel-note">
              These are temporary sample records. Connect this page to the backend report endpoint later.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;