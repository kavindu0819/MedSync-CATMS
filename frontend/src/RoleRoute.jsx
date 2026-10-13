import { Navigate } from "react-router-dom";
import { getSession } from "./auth.js";

export default function RoleRoute({ role, children }) {
  const session = getSession();

  if (!session) return <Navigate to="/" replace />;
  if (session.role !== role) {
    return <Navigate to={session.role === "PATIENT" ? "/patient" : "/admin"} replace />;
  }

  return children;
}
