// Small outline icons for the dashboard (no icon library needed).
// They draw in currentColor, so they take the colour of the text around them.

function Icon({ children, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
);

export const PatientAddIcon = (p) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M18.5 8v6M15.5 11h6" />
  </Icon>
);

export const CalendarIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01" strokeWidth="2.2" />
  </Icon>
);

export const StethoscopeIcon = (p) => (
  <Icon {...p}>
    <path d="M5 3.5v5a4.5 4.5 0 0 0 9 0v-5" />
    <path d="M9.5 13v1.5a5 5 0 0 0 10 0V13" />
    <circle cx="19.5" cy="11" r="2" />
    <path d="M4 3.5h2M13 3.5h2" />
  </Icon>
);

export const WalletIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
    <path d="M16 13.5h1.5" strokeWidth="2.2" />
  </Icon>
);

export const HeartPulseIcon = (p) => (
  <Icon {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
    <path d="M7 12.5h2.5l1.5-2.5 2 4 1.5-1.5H17" />
  </Icon>
);

export const ShieldIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const LogoutIcon = (p) => (
  <Icon {...p}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="M14.5 8 18.5 12l-4 4M18.5 12H9.5" />
  </Icon>
);

export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p) => (
  <Icon {...p}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </Icon>
);

export const UsersIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M8 17c.6-2 2.1-3 4-3s3.4 1 4 3" />
  </Icon>
);

export const BuildingIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20.5h16M6 20.5V6.5L12 3.5l6 3v14" />
    <path d="M12 8.5v4M10 10.5h4M10 20.5v-4h4v4" />
  </Icon>
);

export const ReceiptIcon = (p) => (
  <Icon {...p}>
    <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2Z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3" />
  </Icon>
);

export const CoinsIcon = (p) => (
  <Icon {...p}>
    <ellipse cx="10" cy="6.5" rx="6" ry="2.5" />
    <path d="M4 6.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" />
    <path d="M4 10.5v4c0 1.4 2.7 2.5 6 2.5 1 0 2-.1 2.8-.3" />
    <circle cx="17" cy="16.5" r="3.5" />
  </Icon>
);

export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const RecordsIcon = (p) => (
  <Icon {...p}>
    <path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9Z" />
    <path d="M14 3.5V9h5.5" />
    <path d="M12 12v5M9.5 14.5h5" />
  </Icon>
);

export const PillIcon = (p) => (
  <Icon {...p}>
    <rect x="2.8" y="8.2" width="18.4" height="7.6" rx="3.8" transform="rotate(-45 12 12)" />
    <path d="m8.8 8.8 6.4 6.4" />
  </Icon>
);

// One icon per sidebar tab.
export const TAB_ICONS = {
  Overview: DashboardIcon,
  Patients: PatientAddIcon,
  "Branch appointments": CalendarIcon,
  "Doctor revenue": StethoscopeIcon,
  "Outstanding balances": WalletIcon,
  "Treatment categories": HeartPulseIcon,
  "Insurance coverage": ShieldIcon,
};
