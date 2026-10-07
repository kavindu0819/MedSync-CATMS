// Fictional sample records. Dates are fixed so examples remain reproducible.
export const sampleDate = "2026-09-25";
export const reportDefinitions = {
  "Branch appointments": {
    icon: "calendar", description: "Appointment activity by branch and date.",
    columns: ["branch", "date", "scheduled", "completed", "cancelled", "total"],
    filters: ["branch", "date"], money: [], label: "branch",
    bars: [["completed", "Completed", "#087cf0"], ["scheduled", "Scheduled", "#89c5fd"], ["cancelled", "Cancelled", "#f2a088"]],
  },
  "Doctor revenue": {
    icon: "chart", description: "Consultations, treatments, and revenue by doctor.",
    columns: ["doctor", "branch", "consultations", "treatments", "revenue"],
    filters: ["doctor", "from", "to"], money: ["revenue"], label: "doctor",
    bars: [["revenue", "Revenue", "#087cf0"]],
  },
  "Outstanding balances": {
    icon: "receipt", description: "Unpaid and partly paid invoices.",
    columns: ["patient", "invoice_id", "total", "paid", "outstanding"],
    filters: [], money: ["total", "paid", "outstanding"], label: "invoice_id",
    bars: [["paid", "Paid", "#89c5fd"], ["outstanding", "Outstanding", "#087cf0"]],
  },
  "Treatment categories": {
    icon: "medical", description: "Treatment counts across service categories.",
    columns: ["category", "date", "treatment_count"],
    filters: ["from", "to"], money: [], label: "category",
    bars: [["treatment_count", "Treatments", "#087cf0"]],
  },
  "Insurance coverage": {
    icon: "shield", description: "Insurance and patient contributions by invoice.",
    columns: ["patient", "invoice_id", "insurance_covered", "out_of_pocket"],
    filters: [], money: ["insurance_covered", "out_of_pocket"], label: "invoice_id",
    bars: [["insurance_covered", "Insurance", "#087cf0"], ["out_of_pocket", "Out of pocket", "#89c5fd"]],
  },
};

export const demoRows = {
  "Branch appointments": [
    { branch: "Colombo", date: sampleDate, scheduled: 18, completed: 42, cancelled: 3, total: 63 },
    { branch: "Kandy", date: sampleDate, scheduled: 12, completed: 35, cancelled: 2, total: 49 },
    { branch: "Galle", date: sampleDate, scheduled: 15, completed: 29, cancelled: 1, total: 45 },
  ],
  "Doctor revenue": [
    { doctor: "Dr. Perera", branch: "Colombo", date: sampleDate, consultations: 42, treatments: 17, revenue: 142500 },
    { doctor: "Dr. Fernando", branch: "Kandy", date: sampleDate, consultations: 35, treatments: 9, revenue: 104300 },
    { doctor: "Dr. Silva", branch: "Galle", date: sampleDate, consultations: 29, treatments: 12, revenue: 96800 },
  ],
  "Outstanding balances": [
    { patient: "W.A. Silva", invoice_id: "INV-00231", total: 8500, paid: 3000, outstanding: 5500 },
    { patient: "K.D. Jayasuriya", invoice_id: "INV-00318", total: 12000, paid: 5000, outstanding: 7000 },
  ],
  "Treatment categories": [
    { category: "Diagnostic", date: sampleDate, treatment_count: 61 },
    { category: "Minor Procedure", date: sampleDate, treatment_count: 48 },
    { category: "Therapeutic", date: sampleDate, treatment_count: 36 },
  ],
  "Insurance coverage": [
    { patient: "W.A. Silva", invoice_id: "INV-00231", insurance_covered: 3500, out_of_pocket: 5000 },
    { patient: "K.D. Jayasuriya", invoice_id: "INV-00318", insurance_covered: 5600, out_of_pocket: 6400 },
  ],
};

export const prettyLabel = (key) => ({ invoice_id: "Invoice", from: "From date", to: "To date", doctor: "Doctor name", treatment_count: "Treatments", insurance_covered: "Insurance covered", out_of_pocket: "Out of pocket" }[key] || key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()));

export function money(value) {
  return `LKR ${Number(value).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCell(value, column, definition) {
  if (value === null || value === undefined || value === "") return "—";
  if (definition.money.includes(column) && Number.isFinite(Number(value))) return money(value);
  return String(value);
}

export function normaliseRows(payload, reportName) {
  if (payload?.success === false) throw new Error(payload.message || payload.error || "The report request failed.");
  const rows = Array.isArray(payload) ? payload : payload?.data ?? payload?.rows;
  if (!Array.isArray(rows)) throw new Error("The report returned an unsupported response. Check the agreed API format.");
  const columns = reportDefinitions[reportName].columns;
  if (rows.some((row) => !row || typeof row !== "object" || columns.some((column) => !(column in row)))) {
    throw new Error("The report is missing expected columns. Check the agreed API format.");
  }
  return rows;
}

export function filterDemoRows(name, filters) {
  return demoRows[name].filter((row) => {
    if (filters.branch && row.branch !== filters.branch) return false;
    if (filters.doctor && !row.doctor.toLowerCase().includes(filters.doctor.toLowerCase())) return false;
    if (filters.date && row.date !== filters.date) return false;
    if (filters.from && row.date < filters.from) return false;
    if (filters.to && row.date > filters.to) return false;
    return true;
  });
}
