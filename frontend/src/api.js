import axios from "axios";

// This browser-visible address connects React to the backend, not directly to MySQL.
// Copy .env.example to .env.local if your teammate uses a different address.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 8000,
});

// Proposed report contract. These routes still need to be implemented/confirmed
// by the backend teammate; the previously supplied server had only patients/doctors.
export const reportEndpoints = {
  "Branch appointments": "/reports/branch-appointments",
  "Doctor revenue": "/reports/doctor-revenue",
  "Outstanding balances": "/reports/outstanding-balances",
  "Treatment categories": "/reports/treatment-categories",
  "Insurance coverage": "/reports/insurance-coverage",
};

export async function fetchReport(reportName, filters = {}, signal) {
  if (!reportEndpoints[reportName]) throw new Error("This report has no configured endpoint.");
  const response = await api.get(reportEndpoints[reportName], { params: filters, signal });
  return response.data;
}
