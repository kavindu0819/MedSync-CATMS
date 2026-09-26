import axios from "axios";

// The backend runs separately from the React frontend.
// Change this value only if the backend uses another port.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 8000,
});

// These paths are the API contract expected from the backend teammate.
// Update the paths if your team chooses different names.
export const reportEndpoints = {
  "Branch appointments": "/reports/branch-appointments",
  "Doctor revenue": "/reports/doctor-revenue",
  "Outstanding balances": "/reports/outstanding-balances",
  "Treatment categories": "/reports/treatment-categories",
  "Insurance coverage": "/reports/insurance-coverage",
};

export async function fetchReport(reportName, filters = {}) {
  const endpoint = reportEndpoints[reportName];

  if (!endpoint) {
    throw new Error(`No endpoint has been configured for ${reportName}.`);
  }

  const response = await api.get(endpoint, { params: filters });
  return response.data;
}

export async function checkBackend() {
  // The current backend already has this route in server.js.
  const response = await api.get("/doctors");
  return response.data;
}
