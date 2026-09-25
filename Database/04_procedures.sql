-- =====================================================================
-- MedSync CATMS  |  04_procedures.sql
-- Database Layer - Step 5 (Stored Procedures)  |  Owner: Jayalath K.D
--
-- Four procedures, each wrapped in a single transaction so it is
-- all-or-nothing. This is the ACID demonstration: if any step fails,
-- the EXIT HANDLER rolls the whole thing back and re-raises the error.
--
-- The transaction pattern used by every procedure:
--     DECLARE EXIT HANDLER FOR SQLEXCEPTION
--     BEGIN ROLLBACK; RESIGNAL; END;
--     START TRANSACTION; ... COMMIT;
--
-- Runs AFTER 01..03 and 05 (functions and triggers must already exist).
-- =====================================================================

USE medsync;

DROP PROCEDURE IF EXISTS sp_book_appointment;
DROP PROCEDURE IF EXISTS sp_complete_appointment_and_bill;
DROP PROCEDURE IF EXISTS sp_record_payment;
DROP PROCEDURE IF EXISTS sp_lodge_insurance_claim;

DELIMITER $$

-- ---------------------------------------------------------------------
-- sp_book_appointment
--   Inserts a new appointment. The double-booking trigger performs the
--   overlap check; if it clashes, the EXIT HANDLER rolls back and the
--   caller receives the error. Returns the new appointment_id.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_book_appointment(
    IN  p_patient_id   INT,
    IN  p_doctor_id    INT,
    IN  p_branch_id    INT,
    IN  p_room_id      INT,
    IN  p_date         DATE,
    IN  p_start        TIME,
    IN  p_end          TIME,
    IN  p_is_walkin    BOOLEAN,
    OUT p_appointment_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        INSERT INTO APPOINTMENT
            (patient_id, doctor_id, branch_id, room_id,
             appointment_date, scheduled_start, scheduled_end,
             status, is_walkin)
        VALUES
            (p_patient_id, p_doctor_id, p_branch_id, p_room_id,
             p_date, p_start, p_end,
             'Scheduled', COALESCE(p_is_walkin, FALSE));

        SET p_appointment_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_complete_appointment_and_bill
--   Marks the appointment Completed, stamps the current catalogue price
--   onto each treatment line (price_snapshot), then creates the invoice
--   with the correct total - all in one transaction.
--   Assumes the treatments performed are already recorded as
--   APPT_TREATMENT rows for this appointment.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_complete_appointment_and_bill(
    IN  p_appointment_id INT,
    OUT p_invoice_id     INT
)
BEGIN
    DECLARE v_total DECIMAL(12,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        -- 1. mark the appointment complete (fires the audit trigger)
        UPDATE APPOINTMENT
        SET status = 'Completed'
        WHERE appointment_id = p_appointment_id;

        -- 2. copy catalogue prices onto the treatment lines
        UPDATE APPT_TREATMENT at
        JOIN TREATMENT t ON t.treatment_id = at.treatment_id
        SET at.price_snapshot = t.price
        WHERE at.appointment_id = p_appointment_id;

        -- 3. total the (now stamped) lines and raise the invoice
        SET v_total = fn_treatment_charges(p_appointment_id);

        INSERT INTO INVOICE
            (appointment_id, total_amount, paid_amount, balance_due, status)
        VALUES
            (p_appointment_id, v_total, 0.00, v_total, 'Unpaid');

        SET p_invoice_id = LAST_INSERT_ID();
    COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_record_payment
--   Records a payment against an invoice, but rejects it if the amount
--   exceeds the current outstanding balance (prevents overpayment).
--   The AFTER-INSERT payment trigger then recalculates the invoice.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_record_payment(
    IN p_invoice_id INT,
    IN p_amount     DECIMAL(12,2),
    IN p_method     VARCHAR(30),
    IN p_date       DATE
)
BEGIN
    DECLARE v_outstanding DECIMAL(12,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        SET v_outstanding = fn_outstanding_balance(p_invoice_id);

        IF p_amount > v_outstanding THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Payment exceeds the outstanding balance';
        END IF;

        INSERT INTO PAYMENT
            (invoice_id, payment_date, amount, payment_method)
        VALUES
            (p_invoice_id, COALESCE(p_date, CURRENT_DATE), p_amount, p_method);
    COMMIT;
END$$

-- ---------------------------------------------------------------------
-- sp_lodge_insurance_claim
--   Creates an insurance claim for an invoice using fn_insurance_coverage
--   to compute the reimbursable amount, then re-settles the invoice
--   balance to reflect the approved insurance. Returns the new claim_id.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_lodge_insurance_claim(
    IN  p_invoice_id INT,
    IN  p_policy_id  INT,
    OUT p_claim_id   INT
)
BEGIN
    DECLARE v_coverage DECIMAL(12,2);
    DECLARE v_out      DECIMAL(12,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        SET v_coverage = fn_insurance_coverage(p_invoice_id);

        INSERT INTO INSURANCE_CLAIM
            (policy_id, invoice_id, claimed_amount, approved_amount, status)
        VALUES
            (p_policy_id, p_invoice_id, v_coverage, v_coverage, 'Approved');

        SET p_claim_id = LAST_INSERT_ID();

        -- re-settle the invoice now that insurance has been approved
        SET v_out = fn_outstanding_balance(p_invoice_id);

        UPDATE INVOICE
        SET balance_due = v_out,
            status = CASE
                         WHEN v_out <= 0        THEN 'Paid'
                         WHEN paid_amount > 0   THEN 'Partially Paid'
                         ELSE 'Unpaid'
                     END
        WHERE invoice_id = p_invoice_id;
    COMMIT;
END$$

DELIMITER ;

-- =====================================================================
-- End of 04_procedures.sql
-- Next: 06_indexes.sql (indexes + EXPLAIN verification)
-- =====================================================================
