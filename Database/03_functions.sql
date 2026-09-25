-- =====================================================================
-- MedSync CATMS  |  03_functions.sql
-- Database Layer - Step 3 (Functions)  |  Owner: Jayalath K.D
--
-- Three reusable calculation functions. They are written before the
-- procedures, views and reports because all of those reuse them.
--
-- Each is marked DETERMINISTIC READS SQL DATA so MySQL will create it
-- even with binary logging on (per the plan's MySQL notes).
--
-- Runs AFTER 01_schema.sql + 02_constraints.sql.
-- =====================================================================

USE medsync;

DROP FUNCTION IF EXISTS fn_treatment_charges;
DROP FUNCTION IF EXISTS fn_insurance_coverage;
DROP FUNCTION IF EXISTS fn_outstanding_balance;

DELIMITER $$

-- ---------------------------------------------------------------------
-- fn_treatment_charges(appointment_id)
--   The raw bill for one appointment: the sum of price_snapshot across
--   every treatment line recorded for it. Returns 0 if none.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_treatment_charges(p_appointment_id INT)
    RETURNS DECIMAL(12,2)
    DETERMINISTIC
    READS SQL DATA
BEGIN
    DECLARE v_total DECIMAL(12,2);

    SELECT COALESCE(SUM(price_snapshot), 0.00)
      INTO v_total
    FROM APPT_TREATMENT
    WHERE appointment_id = p_appointment_id;

    RETURN v_total;
END$$

-- ---------------------------------------------------------------------
-- fn_insurance_coverage(invoice_id)
--   The reimbursable amount for an invoice:
--     * only claimable treatments (TREATMENT.is_claimable = TRUE)
--     * multiplied by the patient's policy coverage_percentage
--     * capped at the policy's annual_ceiling
--   Returns 0 if the patient has no policy valid on the visit date.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_insurance_coverage(p_invoice_id INT)
    RETURNS DECIMAL(12,2)
    DETERMINISTIC
    READS SQL DATA
BEGIN
    DECLARE v_appointment_id INT;
    DECLARE v_patient_id      INT;
    DECLARE v_appt_date       DATE;
    DECLARE v_eligible        DECIMAL(12,2);
    DECLARE v_coverage        DECIMAL(5,2)  DEFAULT NULL;
    DECLARE v_ceiling         DECIMAL(12,2) DEFAULT NULL;
    DECLARE v_reimbursable    DECIMAL(12,2);

    -- Find the appointment and patient behind this invoice.
    SELECT a.appointment_id, a.patient_id, a.appointment_date
      INTO v_appointment_id, v_patient_id, v_appt_date
    FROM INVOICE i
    JOIN APPOINTMENT a ON a.appointment_id = i.appointment_id
    WHERE i.invoice_id = p_invoice_id;

    -- Sum of claimable treatment charges on that appointment.
    SELECT COALESCE(SUM(at.price_snapshot), 0.00)
      INTO v_eligible
    FROM APPT_TREATMENT at
    JOIN TREATMENT t ON t.treatment_id = at.treatment_id
    WHERE at.appointment_id = v_appointment_id
      AND t.is_claimable = TRUE;

    -- The patient's policy valid on the visit date (best coverage first).
    SELECT coverage_percentage, annual_ceiling
      INTO v_coverage, v_ceiling
    FROM INSURANCE_POLICY
    WHERE patient_id = v_patient_id
      AND v_appt_date BETWEEN valid_from AND valid_to
    ORDER BY coverage_percentage DESC
    LIMIT 1;

    -- No valid policy -> nothing is reimbursable.
    IF v_coverage IS NULL THEN
        RETURN 0.00;
    END IF;

    SET v_reimbursable = v_eligible * v_coverage / 100;

    -- Apply the annual ceiling cap.
    IF v_reimbursable > v_ceiling THEN
        SET v_reimbursable = v_ceiling;
    END IF;

    RETURN v_reimbursable;
END$$

-- ---------------------------------------------------------------------
-- fn_outstanding_balance(invoice_id)
--   What the patient still owes:
--     total_amount  -  payments received  -  approved insurance
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_outstanding_balance(p_invoice_id INT)
    RETURNS DECIMAL(12,2)
    DETERMINISTIC
    READS SQL DATA
BEGIN
    DECLARE v_total     DECIMAL(12,2);
    DECLARE v_paid      DECIMAL(12,2);
    DECLARE v_insurance DECIMAL(12,2);

    SELECT COALESCE(total_amount, 0.00)
      INTO v_total
    FROM INVOICE
    WHERE invoice_id = p_invoice_id;

    SELECT COALESCE(SUM(amount), 0.00)
      INTO v_paid
    FROM PAYMENT
    WHERE invoice_id = p_invoice_id;

    -- approved_amount is NULL until a claim is adjudicated; SUM skips NULLs.
    SELECT COALESCE(SUM(approved_amount), 0.00)
      INTO v_insurance
    FROM INSURANCE_CLAIM
    WHERE invoice_id = p_invoice_id;

    RETURN v_total - v_paid - v_insurance;
END$$

DELIMITER ;

-- =====================================================================
-- End of 03_functions.sql
-- Next: 05_triggers.sql (and the APPOINTMENT_AUDIT table)
-- =====================================================================
