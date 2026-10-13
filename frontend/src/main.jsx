import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import PatientDashboard from './PatientDashboard.jsx'
import DoctorDashboard from './DoctorDashboard.jsx'
import LoginPage from './LoginPage.jsx'
import { clearSession, getSession } from './auth.js'
import RoleRoute from './RoleRoute.jsx'

function AdminRouteWrapper() {
  const session = getSession();
  return <App user={session?.user} role={session?.role} onLogout={clearSession} />;
}

function DoctorRouteWrapper() {
  const session = getSession();
  return <DoctorDashboard user={session?.user} onLogout={clearSession} />;
}

function PatientRouteWrapper() {
  const session = getSession();
  const user = session?.user;
  return (
    <PatientDashboard
      patientId={user?.patient_id}
      patientName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
      onLogout={clearSession}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RoleRoute role={["ADMIN", "FRONTDESK"]}>
              <AdminRouteWrapper />
            </RoleRoute>
          }
        />
        <Route
          path="/doctor"
          element={
            <RoleRoute role="DOCTOR">
              <DoctorRouteWrapper />
            </RoleRoute>
          }
        />
        <Route
          path="/patient"
          element={
            <RoleRoute role="PATIENT">
              <PatientRouteWrapper />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)