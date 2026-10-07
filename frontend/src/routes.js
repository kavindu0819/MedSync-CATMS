// Separate URL routes without an additional dependency or hosting rewrite rules.
// Example: http://localhost:5173/#/services renders only the Services page.
export const reportRoutes = {
  "Overview": "#/reports",
  "Branch appointments": "#/reports/branch-appointments",
  "Doctor revenue": "#/reports/doctor-revenue",
  "Outstanding balances": "#/reports/outstanding-balances",
  "Treatment categories": "#/reports/treatment-categories",
  "Insurance coverage": "#/reports/insurance-coverage",
};
const titles = { doctors: "Find a doctor", "my-appointments": "My appointments", billing: "Billing & invoices", home: "Care, connected", services: "Our services", about: "About MedSync", contact: "Contact us", appointments: "Book an appointment" };

export function resolveRoute(hash) {
  let path = hash.replace(/^#\/?/, "").replace(/\/$/, "") || "home";
  if (/^billing\/DEMO-\d+$/.test(path)) return { page: "billing", itemId: path.split("/")[1], title: "Invoice details" };
  // Support links saved from the earlier single-page version.
  if (path === "appointment") path = "appointments";
  if (Object.hasOwn(titles, path)) return { page: path, title: titles[path] };
  const report = Object.entries(reportRoutes).find(([, route]) => route === `#/${path}`);
  if (report) return { page: "reports", reportName: report[0], title: report[0] === "Overview" ? "Clinic reports" : report[0] };
  return { page: "not-found", title: "Page not found" };
}
