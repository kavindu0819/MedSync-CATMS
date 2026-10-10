import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authenticate } from "./login";
import { dashboardPath, getSession, saveSession } from "./auth";
import { registerPatient } from "./api";
import Hero3D from "./Hero3D";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const existingSession = getSession();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Registration state
  const [regNic, setRegNic] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (existingSession) {
    return <Navigate to={dashboardPath(existingSession.role)} replace />;
  }

  // Quick fill helper for testing
  function handleSelectDemo(role) {
    setError("");
    setSuccessMsg("");
    setMode("login");
    if (role === "admin") {
      setEmail("admins@medsync.lk");
      setPassword("admin123");
    } else {
      setEmail("patient1@medsync.lk");
      setPassword("patient123");
    }
  }

  // Predicted destination based on typed email
  const normalizedTypedEmail = email.trim().toLowerCase();
  const isAdminEmail =
    normalizedTypedEmail.includes("admin") ||
    normalizedTypedEmail.endsWith("@medsync.lk") && !normalizedTypedEmail.includes("patient");
  const isPatientEmail =
    normalizedTypedEmail.includes("patient") ||
    (normalizedTypedEmail.length > 5 && !isAdminEmail);

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");
    setBusy(true);

    try {
      const session = await authenticate(email, password);
      saveSession(session, remember);
      navigate(dashboardPath(session.role), { replace: true });
    } catch (signInError) {
      setError(signInError.message || "Sign-in failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (regPassword !== regConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const res = await registerPatient(regNic.trim(), regEmail.trim(), regPassword);
      if (res.success) {
        setSuccessMsg("Account successfully registered! You can now sign in.");
        setEmail(regEmail.trim());
        setPassword(regPassword);
        setMode("login");
      } else {
        setError(res.message || "Registration failed.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed. Please verify that your NIC is registered in hospital records."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <Hero3D />
      <section className="login-page__hero">
        <div className="login-page__brand">
          <span className="login-page__logo">M</span>
          <span>
            <strong>MedSync</strong>
            <small>CATMS Healthcare Platform</small>
          </span>
        </div>

        <div className="login-page__message">
          <h2>Every branch,<br />one clear picture.</h2>
          <p>
            Unified Clinical & Administrative Task Management System. Instant access
            to appointments, doctors, billing, and health records.
          </p>
        </div>

        <div className="login-page__callouts">
          <div className="login-page__callout">
            <span className="login-page__callout-dot dot--blue" />
            <div>
              <strong>Role-Aware Access</strong>
              <p>Patients are routed to their personal care dashboard; admins to clinic analytics.</p>
            </div>
          </div>
          <div className="login-page__callout">
            <span className="login-page__callout-dot dot--green" />
            <div>
              <strong>Secure MySQL Integration</strong>
              <p>Backed by encrypted authentication and live relational views.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="login-page__panel">
        <div className="login-page__card">
          <div className="login-page__tabs">
            <button
              type="button"
              className={`login-page__tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`login-page__tab ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}
            >
              Patient Sign Up
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit}>
              <p className="login-page__kicker">Authentication Portal</p>
              <h1>Sign in to MedSync</h1>

              {/* Quick demo credentials picker */}
              <div className="login-page__demo-strip">
                <span className="demo-strip__label">Quick Test:</span>
                <button
                  type="button"
                  className="demo-chip demo-chip--admin"
                  onClick={() => handleSelectDemo("admin")}
                  title="Fills admin email & password"
                >
                  👔 Admin Demo
                </button>
                <button
                  type="button"
                  className="demo-chip demo-chip--patient"
                  onClick={() => handleSelectDemo("patient")}
                  title="Fills patient email & password"
                >
                  🩺 Patient Demo
                </button>
              </div>

              <label className="login-page__field">
                <span>Email address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="e.g. admins@medsync.lk or patient1@medsync.lk"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              {/* Dynamic route destination badge */}
              {email.trim() && (
                <div className={`login-page__route-hint ${isAdminEmail ? "hint--admin" : "hint--patient"}`}>
                  <span className="hint-icon">{isAdminEmail ? "🛡️" : "🩺"}</span>
                  <span>
                    Destined for: <strong>{isAdminEmail ? "Main Admin Dashboard (/admin)" : "Patient Dashboard (/patient)"}</strong>
                  </span>
                </div>
              )}

              <label className="login-page__field">
                <span>Password</span>
                <span className="login-page__password">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    className="login-page__toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>

              <div className="login-page__options">
                <label className="login-page__remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Keep me signed in
                </label>
                <span className="demo-hint-text">
                  Admin: <code>admin123</code> · Patient: <code>patient123</code>
                </span>
              </div>

              {error && <div className="login-page__error" role="alert">{error}</div>}
              {successMsg && <div className="login-page__success" role="status">{successMsg}</div>}

              <button className="login-page__submit" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign In to Dashboard"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <p className="login-page__kicker">Patient Registration</p>
              <h1>Create Patient Portal</h1>
              <p className="login-page__sub">
                Connect your hospital NIC with an email and password to access your health records.
              </p>

              <label className="login-page__field">
                <span>National Identity Card (NIC)</span>
                <input
                  type="text"
                  name="nic"
                  placeholder="e.g. NIC0000001 or hospital registered NIC"
                  value={regNic}
                  onChange={(event) => setRegNic(event.target.value)}
                  required
                />
              </label>

              <label className="login-page__field">
                <span>Email address</span>
                <input
                  type="email"
                  name="email"
                  placeholder="your.email@example.com"
                  value={regEmail}
                  onChange={(event) => setRegEmail(event.target.value)}
                  required
                />
              </label>

              <label className="login-page__field">
                <span>Create Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Minimum 6 characters"
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </label>

              <label className="login-page__field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={regConfirm}
                  onChange={(event) => setRegConfirm(event.target.value)}
                  required
                  minLength={6}
                />
              </label>

              {error && <div className="login-page__error" role="alert">{error}</div>}
              {successMsg && <div className="login-page__success" role="status">{successMsg}</div>}

              <button className="login-page__submit" type="submit" disabled={busy}>
                {busy ? "Registering…" : "Register & Activate Portal"}
              </button>
            </form>
          )}
        </div>
        <p className="login-page__footer">© 2026 MedSync CATMS · Clinical & Administrative Management</p>
      </section>
    </main>
  );
}
