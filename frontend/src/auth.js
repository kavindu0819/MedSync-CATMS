const SESSION_KEY = "medsync_session";

export function getSession() {
  const saved = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!saved) return null;

  try {
    const session = JSON.parse(saved);
    if (
      session?.success &&
      ["ADMIN", "PATIENT"].includes(session.role) &&
      session.user
    ) {
      return session;
    }
  } catch {
    clearSession();
    return null;
  }

  clearSession();
  return null;
}

export function saveSession(session, remember) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function dashboardPath(role) {
  return role === "PATIENT" ? "/patient" : "/admin";
}
