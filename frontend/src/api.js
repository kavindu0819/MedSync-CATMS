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

export async function fetchOverviewSummary() {
  const response = await api.get("/reports/summary");

  if (Array.isArray(response.data)) {
    return response.data[0] ?? null;
  }

  if (response.data && response.data.data && !Array.isArray(response.data.data)) {
    return response.data.data;
  }

  if (response.data && response.data.data && Array.isArray(response.data.data)) {
    return response.data.data[0] ?? null;
  }

  return response.data ?? null;
}

export async function fetchBranches() {
  const response = await api.get("/branches");
  return response.data;
}

export async function fetchBranchMonths(branchId) {
  const response = await api.get("/reports/branch-appointments/months", {
    params: { branchId },
  });
  return response.data;
}

export async function fetchBranchAppointments(branchId, month) {
  const params = month ? { branchId, month } : { branchId };
  const response = await api.get("/reports/branch-appointments", { params });
  return response.data;
}

export async function checkBackend() {
  // The current backend already has this route in server.js.
  const response = await api.get("/doctors");
  return response.data;
}

export async function registerPatient(nic, email, password) {
  const response = await api.post("/patient/register", { nic, email, password });
  return response.data;
}

