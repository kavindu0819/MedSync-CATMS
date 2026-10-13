import { useState } from "react";

// Light/dark choice, shared by the staff and patient dashboards.
const THEME_KEY = "medsync-admin-theme";

export function useDashboardTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch { /* Keep the choice for this visit only. */ }
  }

  return [theme, changeTheme];
}
