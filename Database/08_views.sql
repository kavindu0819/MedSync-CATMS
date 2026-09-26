-- MedSync CATMS - Reporting views (owned by Jayalath K.D / Database Layer)
-- Runs after 07_seed.sql on first container boot.
--
-- Column names match the report rows the frontend renders (frontend/src/api.js
-- and the demoRows block in frontend/src/App.jsx), so each backend endpoint is a
-- single SELECT with no reshaping in JavaScript.
--
-- Views take no parameters, so every view that the UI filters on exposes the
-- raw column to filter by (branch, date). The endpoint adds the WHERE clause.
--
-- Apply without wiping the database:
--   docker exec -i medsync-mysql mysql -umedsync_app -pmedsync_pass medsync < Database/08_views.sql

-- ---------------------------------------------------------------
-- 1. Overview KPI cards  ->  GET /api/reports/summary
--    Always exactly one row.
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM PATIENT)                             AS total_patients,
    (SELECT COUNT(*) FROM APPOINTMENT)                         AS total_appointments,
    (SELECT COUNT(*) FROM BRANCH)                              AS total_branches,
    (SELECT COUNT(*) FROM DOCTOR)                              AS total_doctors,
    (SELECT COALESCE(SUM(total_amount), 0) FROM INVOICE)       AS total_billed,
    (SELECT COALESCE(SUM(paid_amount),  0) FROM INVOICE)       AS total_collected,
    (SELECT COALESCE(SUM(balance_due),  0) FROM INVOICE)       AS outstanding_balance;

-- ---------------------------------------------------------------
-- 2. Branch appointments  ->  GET /api/reports/branch-appointments
--    One row per branch per day. Filters: branch, date.
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_branch_appointments AS
SELECT
    b.name                                            AS branch,
    a.appointment_date                                AS date,
    CAST(SUM(a.status = 'Scheduled') AS UNSIGNED)     AS scheduled,
    CAST(SUM(a.status = 'Completed') AS UNSIGNED)     AS completed,
    CAST(SUM(a.status = 'Cancelled') AS UNSIGNED)     AS cancelled,
    COUNT(*)                                          AS total
FROM APPOINTMENT a
JOIN BRANCH b ON b.branch_id = a.branch_id
GROUP BY b.branch_id, b.name, a.appointment_date;

-- ---------------------------------------------------------------
-- 3. Doctor revenue  ->  GET /api/reports/doctor-revenue
--    One row per doctor per day. Filters: doctor, from, to.
--
--    Consultations and treatments are pre-aggregated per appointment
--    before joining, otherwise a doctor with 2 consultations and 3
--    treatments on one appointment would report 6 of each.
--
--    For a date range the endpoint re-aggregates:
--      SELECT doctor, branch, SUM(consultations) AS consultations,
--             SUM(treatments) AS treatments, SUM(revenue) AS revenue
--      FROM v_doctor_revenue
--      WHERE date BETWEEN ? AND ?
--      GROUP BY doctor, branch;
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_doctor_revenue AS
SELECT
    CONCAT(s.first_name, ' ', s.last_name)      AS doctor,
    b.name                                      AS branch,
    a.appointment_date                          AS date,
    COALESCE(SUM(cx.consultation_count), 0)     AS consultations,
    COALESCE(SUM(tx.treatment_count),    0)     AS treatments,
    COALESCE(SUM(tx.treatment_value),    0)     AS revenue
FROM APPOINTMENT a
JOIN DOCTOR d ON d.doctor_id = a.doctor_id
JOIN STAFF  s ON s.staff_id  = d.doctor_id
JOIN BRANCH b ON b.branch_id = a.branch_id
LEFT JOIN (
    SELECT appointment_id, COUNT(*) AS consultation_count
    FROM CONSULTATION
    GROUP BY appointment_id
) cx ON cx.appointment_id = a.appointment_id
LEFT JOIN (
    SELECT appointment_id,
           COUNT(*)            AS treatment_count,
           SUM(price_snapshot) AS treatment_value
    FROM APPT_TREATMENT
    GROUP BY appointment_id
) tx ON tx.appointment_id = a.appointment_id
GROUP BY d.doctor_id, s.first_name, s.last_name, b.name, a.appointment_date;

-- ---------------------------------------------------------------
-- 4. Outstanding balances  ->  GET /api/reports/outstanding-balances
--    Unpaid invoices only. No filters in the UI.
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_outstanding_balances AS
SELECT
    CONCAT(p.first_name, ' ', p.last_name)  AS patient,
    i.invoice_id                            AS invoice_id,
    i.total_amount                          AS total,
    i.paid_amount                           AS paid,
    i.balance_due                           AS outstanding,
    i.status                                AS status,
    b.name                                  AS branch,
    a.appointment_date                      AS date
FROM INVOICE i
JOIN APPOINTMENT a ON a.appointment_id = i.appointment_id
JOIN PATIENT     p ON p.patient_id     = a.patient_id
JOIN BRANCH      b ON b.branch_id      = a.branch_id
WHERE i.balance_due > 0;

-- ---------------------------------------------------------------
-- 5. Treatment categories  ->  GET /api/reports/treatment-categories
--    One row per category per day. Filters: from, to.
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_treatment_categories AS
SELECT
    tc.category_name                        AS category,
    a.appointment_date                      AS date,
    COUNT(*)                                AS treatment_count,
    COALESCE(SUM(att.price_snapshot), 0)    AS treatment_value
FROM APPT_TREATMENT att
JOIN TREATMENT          t  ON t.treatment_id   = att.treatment_id
JOIN TREATMENT_CATEGORY tc ON tc.category_id   = t.category_id
JOIN APPOINTMENT        a  ON a.appointment_id = att.appointment_id
GROUP BY tc.category_id, tc.category_name, a.appointment_date;

-- ---------------------------------------------------------------
-- 6. Insurance coverage  ->  GET /api/reports/insurance-coverage
--    One row per claim. No filters in the UI.
--    out_of_pocket is what the patient still owes after the approved
--    claim amount, floored at 0 so an over-approved claim never shows
--    a negative balance.
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_insurance_coverage AS
SELECT
    CONCAT(p.first_name, ' ', p.last_name)                          AS patient,
    i.invoice_id                                                    AS invoice_id,
    ip.provider_name                                                AS provider,
    i.total_amount                                                  AS total,
    COALESCE(cl.approved_amount, 0)                                 AS insurance_covered,
    GREATEST(i.total_amount - COALESCE(cl.approved_amount, 0), 0)   AS out_of_pocket,
    cl.status                                                       AS claim_status
FROM INSURANCE_CLAIM  cl
JOIN INVOICE          i  ON i.invoice_id  = cl.invoice_id
JOIN INSURANCE_POLICY ip ON ip.policy_id  = cl.policy_id
JOIN PATIENT          p  ON p.patient_id  = ip.patient_id;
