// These are example branches from the existing dashboard's demo data.
// Replace them with the team's branch API when it is available.
export const branches = ["Colombo", "Kandy", "Galle"];

export function todayInColombo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatAppointmentDate(value) {
  // Parse a date-only string as local midday, avoiding UTC date changes.
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export function validateAppointment(values, today = todayInColombo()) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  const digits = values.phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(values.phone.trim()) || digits.length < 9 || digits.length > 15) errors.phone = "Enter a valid phone number (9–15 digits).";
  if (!branches.includes(values.branch)) errors.branch = "Choose a branch.";
  const date = new Date(`${values.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.date) errors.date = "Choose a preferred date.";
  else if (values.date < today) errors.date = "Choose today or a future date.";
  return errors;
}
