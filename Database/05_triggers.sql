-- =====================================================================
-- MedSync CATMS  |  05_triggers.sql
-- Database Layer - Step 4 (Triggers)  |  Owner: Jayalath K.D
--
-- Triggers fire automatically on insert/update. This file also creates
-- APPOINTMENT_AUDIT (the 18th entity, FR-DB-26), because it exists only
-- to receive rows from trg_appointment_audit.
--
-- Triggers in this file:
--   trg_prevent_double_booking_ins  BEFORE INSERT on APPOINTMENT
--   trg_prevent_double_booking_upd  BEFORE UPDATE on APPOINTMENT
--   trg_update_invoice_on_payment   AFTER  INSERT on PAYMENT
--   trg_appointment_audit           AFTER  UPDATE on APPOINTMENT
--
-- MySQL notes: bodies are wrapped in DELIMITER $$; custom errors use
-- SIGNAL SQLSTATE '45000' (never RAISE EXCEPTION - that is PostgreSQL).
-- A trigger may READ the table it is attached to but not modify it; the
-- double-booking triggers only read APPOINTMENT, so they are valid.
--
-- Runs AFTER 01..03.
-- =====================================================================

USE medsync;

-- ---------------------------------------------------------------------
-- APPOINTMENT_AUDIT  -- 18th entity, receives status-change history
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS APPOINTMENT_AUDIT;

CREATE TABLE APPOINTMENT_AUDIT (
    audit_id        INT             NOT NULL AUTO_INCREMENT,
    appointment_id  INT             NOT NULL,
    old_status      VARCHAR(20)     NULL,
    new_status      VARCHAR(20)     NOT NULL,
    changed_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    CONSTRAINT fk_audit_appointment
        FOREIGN KEY (appointment_id) REFERENCES APPOINTMENT (appointment_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Drop existing triggers so this file is re-runnable
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_double_booking_ins;
DROP TRIGGER IF EXISTS trg_prevent_double_booking_upd;
DROP TRIGGER IF EXISTS trg_update_invoice_on_payment;
DROP TRIGGER IF EXISTS trg_appointment_audit;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Double-booking prevention (INSERT)
--   Two appointments clash when they are for the same doctor, on the
--   same date, and their time ranges overlap. Cancelled appointments
--   are excluded. This is the headline rule of the client brief.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_prevent_double_booking_ins
BEFORE INSERT ON APPOINTMENT
FOR EACH ROW
BEGIN
    DECLARE v_clash INT;

    IF NEW.status <> 'Cancelled' THEN
        SELECT COUNT(*) INTO v_clash
        FROM APPOINTMENT
        WHERE doctor_id        = NEW.doctor_id
          AND appointment_date = NEW.appointment_date
          AND status <> 'Cancelled'
          AND NEW.scheduled_start < scheduled_end
          AND NEW.scheduled_end   > scheduled_start;

        IF v_clash > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Doctor already has an appointment in this time range';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Double-booking prevention (UPDATE)
--   Same check, so rescheduling cannot create an overlap. The row being
--   updated is excluded from the search so it never clashes with itself.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_prevent_double_booking_upd
BEFORE UPDATE ON APPOINTMENT
FOR EACH ROW
BEGIN
    DECLARE v_clash INT;

    IF NEW.status <> 'Cancelled' THEN
        SELECT COUNT(*) INTO v_clash
        FROM APPOINTMENT
        WHERE doctor_id        = NEW.doctor_id
          AND appointment_date = NEW.appointment_date
          AND status <> 'Cancelled'
          AND appointment_id <> NEW.appointment_id
          AND NEW.scheduled_start < scheduled_end
          AND NEW.scheduled_end   > scheduled_start;

        IF v_clash > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Doctor already has an appointment in this time range';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Recalculate the invoice after a payment is inserted
--   paid_amount  = sum of all payments on the invoice
--   balance_due  = total_amount - paid_amount - approved insurance
--   status       = Paid / Partially Paid / Unpaid
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_update_invoice_on_payment
AFTER INSERT ON PAYMENT
FOR EACH ROW
BEGIN
    DECLARE v_total     DECIMAL(12,2);
    DECLARE v_paid      DECIMAL(12,2);
    DECLARE v_insurance DECIMAL(12,2);

    SELECT total_amount INTO v_total
    FROM INVOICE WHERE invoice_id = NEW.invoice_id;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_paid
    FROM PAYMENT WHERE invoice_id = NEW.invoice_id;

    SELECT COALESCE(SUM(approved_amount), 0.00) INTO v_insurance
    FROM INSURANCE_CLAIM WHERE invoice_id = NEW.invoice_id;

    UPDATE INVOICE
    SET paid_amount = v_paid,
        balance_due = v_total - v_paid - v_insurance,
        status      = CASE
                          WHEN (v_total - v_paid - v_insurance) <= 0 THEN 'Paid'
                          WHEN v_paid > 0                             THEN 'Partially Paid'
                          ELSE 'Unpaid'
                      END
    WHERE invoice_id = NEW.invoice_id;
END$$

-- ---------------------------------------------------------------------
-- Audit every appointment status change (FR-DB-26)
--   Writes a row into APPOINTMENT_AUDIT only when status actually
--   changes (e.g. Scheduled -> Completed, Scheduled -> Cancelled).
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_appointment_audit
AFTER UPDATE ON APPOINTMENT
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO APPOINTMENT_AUDIT (appointment_id, old_status, new_status)
        VALUES (NEW.appointment_id, OLD.status, NEW.status);
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- End of 05_triggers.sql
-- Next: 04_procedures.sql
-- =====================================================================
