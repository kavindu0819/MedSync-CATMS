-- =====================================================================
-- MedSync CATMS  |  02_constraints.sql
-- Database Layer - Step 2 (Constraints)  |  Owner: Jayalath K.D
--
-- Adds the CHECK and UNIQUE rules the database refuses to break, no
-- matter who is connecting. NOT NULL and ON DELETE RESTRICT are already
-- defined inline in 01_schema.sql, so this file is CHECK + UNIQUE only.
--
-- Runs AFTER 01_schema.sql (which drops and recreates the schema), so
-- these constraints are always applied to a clean set of tables.
--
-- NOTE: CHECK constraints are only enforced on MySQL 8.0.16+.
--       Verify with:  SELECT VERSION();
-- =====================================================================

USE medsync;

-- ---------------------------------------------------------------------
-- CHECK constraints
-- ---------------------------------------------------------------------

-- APPOINTMENT: the visit must end after it starts, and status is a
-- fixed vocabulary.
ALTER TABLE APPOINTMENT
    ADD CONSTRAINT chk_appt_time
        CHECK (scheduled_end > scheduled_start),
    ADD CONSTRAINT chk_appt_status
        CHECK (status IN ('Scheduled', 'Completed', 'Cancelled'));

-- INVOICE: no negative money anywhere. balance_due >= 0 is the rule
-- that stops overpayment.
ALTER TABLE INVOICE
    ADD CONSTRAINT chk_invoice_balance
        CHECK (balance_due >= 0),
    ADD CONSTRAINT chk_invoice_total
        CHECK (total_amount >= 0),
    ADD CONSTRAINT chk_invoice_paid
        CHECK (paid_amount >= 0);

-- PAYMENT: no zero or negative payments.
ALTER TABLE PAYMENT
    ADD CONSTRAINT chk_payment_amount
        CHECK (amount > 0);

-- INSURANCE_POLICY: coverage is a valid percentage and the policy
-- window is chronological.
ALTER TABLE INSURANCE_POLICY
    ADD CONSTRAINT chk_policy_coverage
        CHECK (coverage_percentage BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_policy_validity
        CHECK (valid_to > valid_from);

-- ---------------------------------------------------------------------
-- UNIQUE constraints
-- ---------------------------------------------------------------------

-- PATIENT: one registration per national identity number (FR-PRM-05).
ALTER TABLE PATIENT
    ADD CONSTRAINT uq_patient_nic UNIQUE (nic);

-- TREATMENT: service codes are unique in the catalogue.
ALTER TABLE TREATMENT
    ADD CONSTRAINT uq_treatment_service_code UNIQUE (service_code);

-- INVOICE: exactly one invoice per appointment.
ALTER TABLE INVOICE
    ADD CONSTRAINT uq_invoice_appointment UNIQUE (appointment_id);

-- CONSULTATION: exactly one consultation per appointment.
ALTER TABLE CONSULTATION
    ADD CONSTRAINT uq_consultation_appointment UNIQUE (appointment_id);

-- BRANCH: exactly one manager per branch (FR-BM-07). manager_id is
-- nullable, and MySQL permits multiple NULLs, so unmanaged branches are
-- still allowed while each real manager is used at most once.
ALTER TABLE BRANCH
    ADD CONSTRAINT uq_branch_manager UNIQUE (manager_id);

-- =====================================================================
-- End of 02_constraints.sql
-- Next: 03_functions.sql
-- =====================================================================
