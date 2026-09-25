-- =====================================================================
-- MedSync CATMS  |  06_indexes.sql
-- Database Layer - Step 6 (Indexes)  |  Owner: Jayalath K.D
--
-- Indexes speed up the searches the double-booking check and the five
-- reports rely on. In production they are added AFTER the seed data is
-- loaded (Step 6, 2-3 Oct) so their effect can be measured with EXPLAIN;
-- here they load fine on an empty schema too.
--
-- Runs LAST, after 01..05.
--
-- Note: foreign-key columns already receive an automatic index from
-- MySQL. The two single-column indexes below reinforce that for their
-- specific report query; the composite indexes are the ones that add
-- genuinely new lookup paths.
-- =====================================================================

USE medsync;

-- Speeds up the double-booking overlap check (NFR-1.2): the trigger
-- searches APPOINTMENT by doctor + date + start time.
CREATE INDEX idx_appt_doctor_schedule
    ON APPOINTMENT (doctor_id, appointment_date, scheduled_start);

-- Speeds up the branch-wise daily summary report.
CREATE INDEX idx_appt_branch_date
    ON APPOINTMENT (branch_id, appointment_date);

-- Speeds up the balance calculation (sum of payments per invoice).
CREATE INDEX idx_payment_invoice
    ON PAYMENT (invoice_id);

-- Speeds up invoice generation and the treatment reports.
CREATE INDEX idx_appttreat_appt
    ON APPT_TREATMENT (appointment_id);

-- Speeds up the outstanding-balance report (filter/scan on balance_due).
CREATE INDEX idx_invoice_balance
    ON INVOICE (balance_due);

-- =====================================================================
-- After 07_seed.sql is loaded, verify each report query uses an index:
--   EXPLAIN SELECT ... ;
-- Look for "index" / "ref" / "range" in the type column and the absence
-- of "ALL" (a full table scan). Save the before/after output - it is
-- direct evidence for NFR-1.3.
--
-- End of 06_indexes.sql  -  the six Database Layer files are complete.
-- =====================================================================
