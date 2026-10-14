# MedSync CATMS

A clinic appointment and treatment management system for the three MedSync branches (Colombo, Kandy, Galle). Staff manage patients and view reports, doctors see and complete their appointments, and patients book visits and check their bills online.

**Live site:** https://wonderful-plant-0fc913700.4.azurestaticapps.net

Built with **React (Vite)**, **Node.js + Express** and **MySQL 8**.

---

## Who can do what

| Role | Who | Page | Can do |
|---|---|---|---|
| **Admin** | system admin, branch managers, nurses | `/admin` | Overview, add patients, and all reports |
| **Front desk** | STAFF with role *Receptionist* | `/admin` | Overview and add patients only |
| **Doctor** | STAFF with role *Doctor* | `/doctor` | Their own appointments (Today / Upcoming / Past); mark started visits completed |
| **Patient** | anyone with an online account | `/patient` | Appointments (book / cancel), records, bills, insurance |

The backend checks the role on the admin, front desk, doctor and cancel routes, not just the frontend (see *Known limitations*).

### Demo logins

These come from the seed data. The login page also has one-click **Demo** links.

| Role | Email | Password |
|---|---|---|
| Admin | `admins@medsync.lk` | `admin123` |
| Front desk | `tharindu.p@medsync.lk` | `staff123` |
| Doctor | `pradeep.a@medsync.lk` | `staff123` |
| Patient | `sewwandi.silva@example.com` | `patient123` |

Every seeded patient can sign in with `patient123`. New patients are added by the front desk first, then create their own account on the sign-up page using their NIC.

---

## Project structure

```
MedSync-CATMS/
├── Database/            MySQL scripts, run in order on first start
│   ├── 01_schema.sql        tables
│   ├── 02_constraints.sql   unique / check constraints
│   ├── 03_functions.sql     fn_treatment_charges, fn_insurance_coverage, fn_outstanding_balance
│   ├── 04_procedures.sql    transactional procedures (booking, billing, payments, claims)
│   ├── 05_triggers.sql      double-booking check, invoice update on payment, appointment audit
│   ├── 06_indexes.sql       indexes for the booking check and reports
│   ├── 07_seed.sql          starting data
│   ├── 08_views.sql         report views (v_dashboard_summary, v_branch_appointments, …)
│   ├── 09_seed_history.sql  a year of appointment history
│   ├── 10_login_modify.sql  patient logins (password patient123)
│   └── docker-compose.yml   local MySQL in Docker
├── backend/             Express API (server.js) + MySQL pool (docker_connect.js)
├── frontend/            React app (Vite)
│   └── src/
│       ├── LoginPage.jsx         sign in / patient sign-up
│       ├── App.jsx               admin + front desk dashboard (all report tabs)
│       ├── DoctorDashboard.jsx   doctor dashboard
│       ├── PatientDashboard.jsx  patient dashboard
│       ├── api.js                every call to the backend (adds the login token)
│       ├── auth.js, login.js     saving the session, signing in
│       └── RoleRoute.jsx         blocks pages you don't have the role for
├── ER diagram/          E-R diagram (PDF)
└── SRS diagram/         Software Requirement Specification (PDF)
```

---

## Running it locally

You need **Docker**, **Node.js 20+** and **npm**.

### 1. Database (MySQL in Docker)

```bash
cd Database
docker compose up -d
```

On the **first** start, MySQL runs every `.sql` file in `Database/` in order, which takes a minute or two. It listens on **localhost:3307** (3307 so it doesn't clash with a local MySQL on 3306).

| | |
|---|---|
| Database | `medsync` |
| App user | `medsync_app` / `medsync_pass` |
| Root | `root` / `medsync_root` |

To start again from a clean database, wipe the data and re-run all scripts:

```bash
docker compose down -v && docker compose up -d
```

### 2. Backend (port 5000)

```bash
cd backend
npm install
npm start
```

Check it works: open http://localhost:5000/api/doctors and you should see 6 doctors.

Restart the backend after every change to `server.js`. It also forgets all logins when it restarts, so you'll be signed out.

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend calls `http://localhost:5000/api` unless `VITE_API_BASE_URL` is set.

---

## Main API routes

| Route | Who | What |
|---|---|---|
| `POST /api/auth/login` | anyone | sign in; returns role + token |
| `POST /api/patient/register` | anyone | patient creates an online account (NIC must already exist) |
| `POST /api/patients` | admin, front desk | add a patient |
| `GET /api/reports/summary`, `/branch-summary` | admin, front desk | Overview cards and chart |
| `GET /api/reports/branch-appointments` (+ `/months`) | admin | per-branch daily appointments |
| `GET /api/reports/doctor-revenue` | admin | revenue per doctor |
| `GET /api/reports/outstanding-balances?page=` | admin | unpaid invoices, 100 per page |
| `GET /api/reports/treatment-categories` | admin | treatments per category |
| `GET /api/reports/insurance-coverage?page=` | admin | insurance claims, 100 per page |
| `GET /api/doctor/appointments?scope=` | doctor | own appointments: `today`, `upcoming`, `past` |
| `PATCH /api/doctor/appointments/:id/complete` | doctor | mark own started appointment completed |
| `GET /api/patients/:id/dashboard` | patient page (no login check yet) | patient dashboard data |
| `POST /api/appointments` | patient page (no login check yet) | book an appointment |
| `PATCH /api/patient/appointments/:id/cancel` | patient | cancel own appointment |

Protected routes need `Authorization: Bearer <token>`. `api.js` adds it automatically. A missing or expired token gives **401**, and the wrong role gives **403**.

---

## Hosting (Azure)

| Part | Azure service | Name |
|---|---|---|
| Website | Static Web Apps (Free) | `medsync-web` |
| Backend | App Service, Linux, Node 22 | `medsyncapi` |
| Database | Azure Database for MySQL – Flexible Server (Burstable B1ms) | `medsync-db` |

All three are in the resource group `medsync-rg`.

### Automatic deploys (GitHub Actions)

Merging to **`main`** deploys automatically:

| Workflow | Runs when | Does |
|---|---|---|
| `azure-static-web-apps-….yml` | any push to `main` | builds `frontend/` with `VITE_API_BASE_URL` set to the Azure backend, then uploads it |
| `main_medsyncapi.yml` | a push to `main` that changes `backend/` | checks syntax, uploads `backend/` to App Service; Azure runs `npm install` |

Pull requests into `main` also get a temporary **preview** copy of the website.

### Backend settings on Azure

Set in **medsyncapi → Settings → Environment variables**. They're never stored in the code:

`DB_HOST`, `DB_PORT` (3306), `DB_USER`, `DB_PASSWORD`, `DB_NAME` (medsync), `DB_SSL=true` (Azure MySQL requires TLS), `TZ=Asia/Colombo`, `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

### Database changes

The pipelines don't touch the database. Run new SQL against `medsync-db` yourself, for example from MySQL Workbench with SSL set to *Require*. Azure has its own copy of the data, separate from your local Docker database.

---

## Known limitations

- Staff passwords are shared demo passwords (`admin123` / `staff123`) and are shown on the login page. Fine for a demo with fake data, not for real patients.
- Logins are kept in the backend's memory, so a restart or redeploy signs everyone out.
- The seed data ends on 30 Sep 2026, so "Today" and "Upcoming" lists are mostly empty.
- Branch managers and nurses currently sign in with full admin access.
- Some routes have no login check yet: `GET /api/patients`, `GET /api/appointments`, `GET /api/patients/:id/dashboard` and `POST /api/appointments`.
