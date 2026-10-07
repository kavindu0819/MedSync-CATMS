import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchReport } from "../api";
import { reportRoutes } from "../routes";
import { branches } from "../appointment";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { demoRows, filterDemoRows, formatCell, money, normaliseRows, prettyLabel, reportDefinitions, sampleDate } from "./reportData";
import "./Reports.css";

const names = Object.keys(reportDefinitions);

function ReportChart({ name, rows }) {
  if (!rows.length) return null;
  const definition = reportDefinitions[name];
  const data = rows.map((row) => ({ ...row, ...Object.fromEntries(definition.bars.map(([key]) => [key, Number(row[key] || 0)])) }));
  return <div className="report-chart" role="img" aria-label={`${name} chart. Exact values appear in the table below.`}>
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5edf3" />
        <XAxis dataKey={definition.label} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#62798c" }} />
        <YAxis width={65} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#62798c" }} tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value} />
        <Tooltip formatter={(value, label) => [definition.money.length ? money(value) : value, label]} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
        {definition.bars.map(([key, label, color]) => <Bar key={key} dataKey={key} name={label} fill={color} maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

function ReportTable({ name, rows }) {
  const definition = reportDefinitions[name];
  if (!rows.length) return <p className="report-empty" role="status">No results match these filters.</p>;
  return <div className="report-table-scroll" tabIndex={0} role="region" aria-label={`${name} results`}>
    <table><caption>{name} · {rows.length} {rows.length === 1 ? "result" : "results"}</caption>
      <thead><tr>{definition.columns.map((key) => <th scope="col" key={key}>{prettyLabel(key)}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{definition.columns.map((key) => <td key={key}>{formatCell(row[key], key, definition)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function ReportView({ name, mode }) {
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({});
  const [filterError, setFilterError] = useState("");
  const [result, setResult] = useState({ loading: mode === "live", rows: [], error: "" });
  const [revision, setRevision] = useState(0);
  const fields = reportDefinitions[name].filters;

  useEffect(() => {
    if (mode !== "live") return;
    const controller = new AbortController();
    let active = true;
    setResult({ loading: true, rows: [], error: "" });
    fetchReport(name, filters, controller.signal)
      .then((payload) => { if (active) setResult({ loading: false, rows: normaliseRows(payload, name), error: "" }); })
      .catch((error) => {
        if (active) setResult({ loading: false, rows: [], error: error.response?.data?.message || error.response?.data?.error || (error.response ? `The report request failed (${error.response.status}).` : error.message === "Network Error" ? "Cannot reach the backend. Check that it is running and allows this frontend address." : error.message) });
      });
    // Cancelling prevents an old response from replacing the newly selected report.
    return () => { active = false; controller.abort(); };
  }, [name, mode, filters, revision]);

  const rows = mode === "demo" ? filterDemoRows(name, filters) : result.rows;
  function apply(event) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) { setFilterError("The from date must be on or before the to date."); return; }
    setFilterError("");
    setFilters(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)));
  }
  return <>
    <div className={mode === "demo" ? "report-notice" : "report-notice live-notice"} role="status">{mode === "demo" ? `Sample data only. Example activity is dated ${sampleDate}.` : "Live mode requests data from your configured backend. Sample data is never used in this mode."}</div>
    <section className="report-panel">
      {fields.length > 0 && <form className="report-filters" onSubmit={apply}>
        {fields.map((field) => <label key={field}><span>{prettyLabel(field)}</span>{field === "branch"
          ? <select value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}><option value="">All branches</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select>
          : <input type={field === "doctor" ? "text" : "date"} placeholder={field === "doctor" ? "e.g. Perera" : undefined} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />}</label>)}
        <button type="submit" className="button button-blue">Apply filters</button>
        <button type="button" className="button button-outline" onClick={() => { setDraft({}); setFilters({}); setFilterError(""); }}>Reset</button>
      </form>}
      {filterError && <p className="report-error" role="alert">{filterError}</p>}
      {mode === "live" && result.loading ? <p className="report-empty" role="status">Loading report…</p>
        : mode === "live" && result.error ? <div className="report-error" role="alert"><p>{result.error}</p><button className="button button-outline" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
          : <><ReportChart name={name} rows={rows} /><ReportTable name={name} rows={rows} /></>}
    </section>
  </>;
}

function Overview({ choose }) {
  const appointments = demoRows["Branch appointments"].reduce((sum, row) => sum + row.total, 0);
  const completed = demoRows["Branch appointments"].reduce((sum, row) => sum + row.completed, 0);
  const outstanding = demoRows["Outstanding balances"].reduce((sum, row) => sum + row.outstanding, 0);
  return <>
    <div className="report-notice">Sample overview · Fictional example data for {sampleDate}. Open a report and choose Live API to connect your backend.</div>
    <section className="report-metrics" aria-label="Sample totals">
      <article><Icon name="calendar" /><span>Appointments</span><strong>{appointments}</strong><small>Across 3 example branches</small></article>
      <article><Icon name="check" /><span>Completed</span><strong>{completed}</strong><small>From the sample appointments</small></article>
      <article><Icon name="receipt" /><span>Outstanding</span><strong>{money(outstanding)}</strong><small>Across 2 example invoices</small></article>
    </section>
    <section className="report-panel"><div className="report-panel-heading"><div><span className="section-kicker">SAMPLE APPOINTMENTS</span><h2>Branch activity</h2></div><button className="text-link text-button" onClick={() => choose("Branch appointments")}>View report <Icon name="arrow" size={17} /></button></div><ReportChart name="Branch appointments" rows={demoRows["Branch appointments"]} /></section>
    <section className="report-links" aria-label="All reports">{names.map((name) => <button key={name} onClick={() => choose(name)}><Icon name={reportDefinitions[name].icon} /><span><strong>{name}</strong><small>{reportDefinitions[name].description}</small></span><Icon name="arrow" size={18} /></button>)}</section>
  </>;
}

export default function Reports({ selected = "Overview" }) {
  function setSelected(name) { window.location.hash = reportRoutes[name]; }
  const [mode, setMode] = useState("demo");
  return <div className="reports-page" id="reports-top">
    <aside className="reports-sidebar"><a href="#/home" aria-label="MedSync home"><Logo /></a><p className="reports-nav-caption">CLINIC WORKSPACE</p><nav aria-label="Report navigation">{["Overview", ...names].map((name) => <button key={name} className={name === selected ? "is-active" : ""} aria-current={name === selected ? "page" : undefined} onClick={() => setSelected(name)}><Icon name={name === "Overview" ? "chart" : reportDefinitions[name].icon} size={18} />{name}</button>)}</nav><a className="back-home" href="#/home"><span>←</span> Back to website</a><p className="reports-sidebar-note">MedSync CATMS<br />Report dashboard</p></aside>
    <main className="reports-main" tabIndex={-1}><header className="reports-topbar"><div><span className="section-kicker">MEDSYNC / CLINIC REPORTS</span><h1>{selected}</h1><p>{selected === "Overview" ? "A clearer view of your clinic." : reportDefinitions[selected].description}</p></div><a href="#/home" className="button button-outline">View website <Icon name="arrow" size={17} /></a></header>
      {selected !== "Overview" && <div className="report-mode" aria-label="Report data source"><button aria-pressed={mode === "demo"} onClick={() => setMode("demo")}>Demo data</button><button aria-pressed={mode === "live"} onClick={() => setMode("live")}>Live API</button></div>}
      {selected === "Overview" ? <Overview choose={setSelected} /> : <ReportView key={`${selected}-${mode}`} name={selected} mode={mode} />}
      <footer className="reports-footer">These analytical reports use separate sample fixtures; they do not include bookings made in the demo workspace. For current session totals, open <a href="#/billing">Billing</a>. MedSync CATMS · The overview uses sample data. Live reports require the backend and its access controls.</footer>
    </main>
  </div>;
}
