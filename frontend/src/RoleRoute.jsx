import { Navigate } from "react-router-dom";
import { dashboardPath, getSession } from "./auth.js";

// role can be one role ("PATIENT") or a list (["ADMIN", "FRONTDESK"]).
export default function RoleRoute({ role, children }) {
  const session = getSession();
  const allowed = Array.isArray(role) ? role : [role];

  if (!session) return <Navigate to="/" replace />;
  if (!allowed.includes(session.role)) {
    return <Navigate to={dashboardPath(session.role)} replace />;
  }

  return children;
}
