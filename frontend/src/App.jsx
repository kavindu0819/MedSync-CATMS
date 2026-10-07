import { lazy, Suspense, useEffect, useState } from "react";
import { ClinicProvider } from "./ClinicContext";
import LandingPage from "./LandingPage";
import { resolveRoute } from "./routes";
import "./App.css";

// Load the chart library only when the Reports page is opened.
const Reports = lazy(() => import("./reports/Reports"));

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  const route = resolveRoute(hash);

  useEffect(() => {
    const changePage = () => setHash(window.location.hash);
    window.addEventListener("hashchange", changePage);
    return () => window.removeEventListener("hashchange", changePage);
  }, []);

  useEffect(() => {
    document.title = `${route.title} | MedSync`;
    // Every navigation replaces the page and starts at the top. Back/Forward
    // and refreshing a direct page URL work through the hashchange listener.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.querySelector("main")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, route.title]);

  return <ClinicProvider>{route.page === "reports"
    ? <Suspense fallback={<main className="page-loading" role="status">Loading reports…</main>}><Reports selected={route.reportName} /></Suspense>
    : <LandingPage key={`${route.page}-${route.itemId || ""}`} page={route.page} itemId={route.itemId} />}</ClinicProvider>;
}
