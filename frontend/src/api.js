import axios from "axios";
import { clearSession, getSession } from "./auth";

// The backend runs separately from the React frontend.
// Change this value only if the backend uses another port.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 8000,
});

// Send the signed-in user's token with every request, so the backend can
// check who is asking (requireRole / requirePatient in server.js).
api.interceptors.request.use((config) => {
  const token = getSession()?.token;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 means the server no longer recognises the session (expired, or the
// backend restarted and forgot it). Send the user back to sign in rather than
// leaving pages half-loaded. Login and sign-up answer 401 for a wrong password,
// so those are left for the login page to show.
const AUTH_PATHS = ["/auth/login", "/patient/register"];
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = AUTH_PATHS.some((path) => error.config?.url?.startsWith(path));
    if (error.response?.status === 401 && !isAuthRequest) {
      clearSession();
      window.location.assign("/");
    }
    return Promise.reject(error);
  }
);

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

export async function fetchOutstandingBalances(page) {
  const response = await api.get("/reports/outstanding-balances", { params: { page } });
  return response.data;
}

export async function fetchInsuranceCoverage(page) {
  const response = await api.get("/reports/insurance-coverage", { params: { page } });
  return response.data;
}

// Admin and front desk only (server.js checks the role).
export async function createPatient(patient) {
  const response = await api.post("/patients", patient);
  return response.data;
}

// Doctor only. scope: "today" | "upcoming" | "past" (server.js decides which
// doctor from the session token).
export async function fetchDoctorAppointments(scope) {
  const response = await api.get("/doctor/appointments", { params: { scope } });
  return response.data.appointments;
}

// Patient only: pay (part of) one of their own bills. method: "Card" | "Bank Transfer".
// server.js runs it through sp_record_payment, which refuses overpaying.
export async function payInvoice(invoiceId, amount, method) {
  const response = await api.post(`/patient/invoices/${invoiceId}/pay`, { amount, method });
  return response.data;
}

// Doctor only: mark one of their own started, Scheduled appointments Completed.
export async function completeDoctorAppointment(appointmentId) {
  const response = await api.patch(`/doctor/appointments/${appointmentId}/complete`);
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

export async function fetchDoctorsByBranch(branchId) {
  const response = await api.get("/doctors", { params: { branchId } });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function fetchAppointmentAvailability(branchId, doctorId, date) {
  const response = await api.get("/appointments/availability", {
    params: { branchId, doctorId, date },
  });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function bookAppointment({ patientId, branchId, doctorId, date, start }) {
  const response = await api.post("/appointments", {
    patient_id: Number(patientId),
    branch_id: Number(branchId),
    doctor_id: Number(doctorId),
    appointment_date: date,
    scheduled_start: start,
    room_id: null,
    status: "Scheduled",
    is_walkin: false,
  });
  return response.data;
}
