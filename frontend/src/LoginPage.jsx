import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authenticate } from "./login";
import { dashboardPath, getSession, saveSession } from "./auth";
import { registerPatient } from "./api";
import heroImage from "./assets/hero.jpg";
import "./LoginPage.css";

// Right-hand image panel copy, one set per mode.
const HERO_COPY = {
  login: {
    title: "Every branch, one clear picture.",
    text: "Appointments, doctors, billing and insurance for every MedSync clinic in one secure platform.",
  },
  register: {
    title: "Your health records, wherever you visit.",
    text: "Link your NIC once to see your appointments, bills and insurance claims across every MedSync branch.",
  },
};

function Logo() {
  return (
    <div className="auth__logo">
      {/* Green cross, the same mark as the dashboard sidebar */}
      <span className="auth__logo-mark" aria-hidden="true" />
      MedSync
    </div>
  );
}

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

  function switchMode(next) {
    setMode(next);
    setError("");
    setSuccessMsg("");
  }

  // Quick fill helper for testing
  function handleSelectDemo(role) {
    switchMode("login");
    if (role === "admin") {
      setEmail("admins@medsync.lk");
      setPassword("admin123");
    } else if (role === "doctor") {
      setEmail("doctor@medsync.lk");
      setPassword("doctor123");
    } else {
      setEmail("sewwandi.silva@example.com"); // patient 4, seeded by Database/10_login_modify.sql
      setPassword("patient123");
    }
  }

  // Predicted destination based on typed email
  const normalizedTypedEmail = email.trim().toLowerCase();
  const isDoctorEmail = normalizedTypedEmail.includes("doctor");
  const isAdminEmail =
    normalizedTypedEmail.includes("admin") ||
    (normalizedTypedEmail.endsWith("@medsync.lk") && !normalizedTypedEmail.includes("patient") && !isDoctorEmail);

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
        setEmail(regEmail.trim());
        setPassword(regPassword);
        setMode("login");
        setSuccessMsg("Account created. You can sign in now.");
      } else {
        setError(res.message || "Registration failed.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed. Please check that your NIC is registered at a MedSync branch."
      );
    } finally {
      setBusy(false);
    }
  }

  const hero = HERO_COPY[mode];

  return (
    <main className="auth">
      <section className="auth__panel">
        <Logo />

        <div className="auth__form-wrap">
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
                  className="demo-chip demo-chip--doctor"
                  onClick={() => handleSelectDemo("doctor")}
                  title="Fills doctor email & password"
                >
                  🩺 Doctor Demo
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
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              {/* Dynamic route destination badge */}
              {email.trim() && (
                <div className={`login-page__route-hint ${isDoctorEmail ? "hint--doctor" : isAdminEmail ? "hint--admin" : "hint--patient"}`}>
                  <span className="hint-icon">{isDoctorEmail ? "🩺" : isAdminEmail ? "🛡️" : "👤"}</span>
                  <span>
                    Destined for: <strong>{isDoctorEmail ? "Doctor Dashboard (/doctor)" : isAdminEmail ? "Main Admin Dashboard (/admin)" : "Patient Dashboard (/patient)"}</strong>
                  </span>
                </div>
              )}

              <label className="login-page__field">
                <span>Password</span>
                <span className="auth__password">
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
                    className="auth__toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>

              <label className="auth__remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Keep me signed in
              </label>

              {error && <div className="auth__alert auth__alert--error" role="alert">{error}</div>}
              {successMsg && <div className="auth__alert auth__alert--success" role="status">{successMsg}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>

              <p className="auth__switch">
                New patient?{" "}
                <button type="button" className="auth__link" onClick={() => switchMode("register")}>
                  Create an account
                </button>
              </p>

              <p className="auth__demo">
                Demo:{" "}
                <button type="button" className="auth__link" onClick={() => handleSelectDemo("admin")}>
                  Admin
                </button>
                {" · "}
                <button type="button" className="auth__link" onClick={() => handleSelectDemo("frontdesk")}>
                  Front desk
                </button>
                {" · "}
                <button type="button" className="auth__link" onClick={() => handleSelectDemo("patient")}>
                  Patient
                </button>
              </p>
            </form>
          ) : (
            <form className="auth__form" onSubmit={handleRegisterSubmit}>
              <h1>Create your account</h1>
              <p className="auth__lead">
                Use the NIC registered at your MedSync branch to access your health records.
              </p>

              <label className="auth__field">
                <span>NIC number</span>
                <input
                  type="text"
                  name="nic"
                  autoComplete="off"
                  placeholder="Enter your NIC"
                  value={regNic}
                  onChange={(event) => setRegNic(event.target.value)}
                  required
                />
              </label>

              <label className="auth__field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={regEmail}
                  onChange={(event) => setRegEmail(event.target.value)}
                  required
                />
              </label>

              <label className="auth__field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                  required
                  minLength={6}
                />
                <small className="auth__hint">Must be at least 6 characters.</small>
              </label>

              <label className="auth__field">
                <span>Confirm password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={regConfirm}
                  onChange={(event) => setRegConfirm(event.target.value)}
                  required
                  minLength={6}
                />
              </label>

              {error && <div className="auth__alert auth__alert--error" role="alert">{error}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? "Creating account…" : "Create account"}
              </button>

              <p className="auth__switch">
                Already have an account?{" "}
                <button type="button" className="auth__link" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <footer className="auth__footer">
          <span>© 2026 MedSync CATMS</span>
          <span>Trouble signing in? Ask at any branch front desk.</span>
        </footer>
      </section>

      <section className="auth__hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="auth__hero-content">
          <h2>{hero.title}</h2>
          <p>{hero.text}</p>
          <div className="auth__branches">
            <span>Colombo</span>
            <span>Kandy</span>
            <span>Galle</span>
          </div>
        </div>
      </section>
    </main>
  );
}