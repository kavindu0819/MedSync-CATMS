-- =====================================================================
-- MedSync CATMS  |  01_schema.sql
-- Database Layer - Step 1 (Tables)  |  Owner: Jayalath K.D
--
-- Translates the ERD into CREATE TABLE statements in dependency order.
-- One entity = one table; one relationship line = one foreign key.
--
-- Conventions (per Project Execution Plan section 6.1):
--   * ENGINE=InnoDB  -> required for foreign keys + transactions
--   * CHARSET=utf8mb4
--   * Money columns are DECIMAL(12,2)  (never FLOAT/DOUBLE) - constraint C-6
--   * Foreign keys use ON DELETE RESTRICT (MySQL default) to block orphan
--     rows - FR-DB-05 / FR-DB-11. CHECK and UNIQUE rules live in
--     02_constraints.sql; indexes live in 06_indexes.sql.
--
-- Re-runnable: drops and recreates the whole schema from scratch.
-- NOTE: APPOINTMENT_AUDIT (the 18th entity, FR-DB-26) is created together
--       with its trigger in 05_triggers.sql.
-- =====================================================================

DROP DATABASE IF EXISTS medsync;
CREATE DATABASE medsync;
USE medsync;

-- ---------------------------------------------------------------------
-- 1. Independent lookup tables (no foreign keys)
-- ---------------------------------------------------------------------
CREATE TABLE TREATMENT_CATEGORY (
    category_id     INT             NOT NULL AUTO_INCREMENT,
    category_name   VARCHAR(100)    NOT NULL,
    PRIMARY KEY (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE SPECIALTY (
    specialty_id    INT             NOT NULL AUTO_INCREMENT,
    specialty_name  VARCHAR(100)    NOT NULL,
    description     VARCHAR(255)    NULL,
    PRIMARY KEY (specialty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. BRANCH  -- created WITHOUT the manager_id foreign key for now.
--    (BRANCH.manager_id -> STAFF and STAFF.branch_id -> BRANCH form a
--     circular reference; the manager_id FK is added in step 4 below.)
-- ---------------------------------------------------------------------
CREATE TABLE BRANCH (
    branch_id       INT             NOT NULL AUTO_INCREMENT,
    manager_id      INT             NULL,          -- FK added in step 4
    name            VARCHAR(50)     NOT NULL,
    address         VARCHAR(100)    NOT NULL,
    city            VARCHAR(50)     NOT NULL,
    phone           VARCHAR(20)     NULL,
    email           VARCHAR(100)    NULL,
    PRIMARY KEY (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. STAFF  -- points to BRANCH
-- ---------------------------------------------------------------------
CREATE TABLE STAFF (
    staff_id        INT             NOT NULL AUTO_INCREMENT,
    branch_id       INT             NOT NULL,
    first_name      VARCHAR(50)     NOT NULL,
    last_name       VARCHAR(50)     NOT NULL,
    role            VARCHAR(50)     NOT NULL,
    is_medical      BOOLEAN         NOT NULL DEFAULT FALSE,
    phone           VARCHAR(20)     NULL,
    email           VARCHAR(100)    NULL,
    PRIMARY KEY (staff_id),
    CONSTRAINT fk_staff_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. Close the circular reference: add BRANCH.manager_id -> STAFF
-- ---------------------------------------------------------------------
ALTER TABLE BRANCH
    ADD CONSTRAINT fk_branch_manager
        FOREIGN KEY (manager_id) REFERENCES STAFF (staff_id)
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 5. DOCTOR, ROOM, DOCTOR_SPECIALTY
-- ---------------------------------------------------------------------
-- A doctor IS a staff member: doctor_id is both PK and FK to STAFF.
CREATE TABLE DOCTOR (
    doctor_id       INT             NOT NULL,      -- = STAFF.staff_id
    branch_id       INT             NOT NULL,
    registration_no INT             NOT NULL,
    PRIMARY KEY (doctor_id),
    CONSTRAINT fk_doctor_staff
        FOREIGN KEY (doctor_id) REFERENCES STAFF (staff_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_doctor_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ROOM (
    room_id         INT             NOT NULL AUTO_INCREMENT,
    branch_id       INT             NOT NULL,
    room_number     VARCHAR(20)     NOT NULL,
    PRIMARY KEY (room_id),
    CONSTRAINT fk_room_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Junction table: a doctor has one or more specialties (composite PK).
CREATE TABLE DOCTOR_SPECIALTY (
    doctor_id       INT             NOT NULL,
    specialty_id    INT             NOT NULL,
    PRIMARY KEY (doctor_id, specialty_id),
    CONSTRAINT fk_docspec_doctor
        FOREIGN KEY (doctor_id) REFERENCES DOCTOR (doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_docspec_specialty
        FOREIGN KEY (specialty_id) REFERENCES SPECIALTY (specialty_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. PATIENT, EMERGENCY_CONTACT, INSURANCE_POLICY
-- ---------------------------------------------------------------------
CREATE TABLE PATIENT (
    patient_id      INT             NOT NULL AUTO_INCREMENT,
    nic             VARCHAR(20)     NOT NULL,
    guardian_nic    VARCHAR(20)     NULL,          -- only for minors
    first_name      VARCHAR(50)     NOT NULL,
    last_name       VARCHAR(50)     NOT NULL,
    dob             DATE            NOT NULL,
    gender          VARCHAR(10)     NOT NULL,
    address         VARCHAR(100)    NULL,
    phone           VARCHAR(20)     NULL,
    PRIMARY KEY (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE EMERGENCY_CONTACT (
    contact_id      INT             NOT NULL AUTO_INCREMENT,
    patient_id      INT             NOT NULL,
    name            VARCHAR(50)     NOT NULL,
    relationship    VARCHAR(50)     NOT NULL,
    phone           VARCHAR(20)     NOT NULL,
    PRIMARY KEY (contact_id),
    CONSTRAINT fk_emergency_patient
        FOREIGN KEY (patient_id) REFERENCES PATIENT (patient_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE INSURANCE_POLICY (
    policy_id           INT             NOT NULL AUTO_INCREMENT,
    patient_id          INT             NOT NULL,
    provider_name       VARCHAR(20)     NOT NULL,
    policy_no           VARCHAR(50)     NOT NULL,
    coverage_percentage DECIMAL(5,2)    NOT NULL,   -- a percentage, not money
    annual_ceiling      DECIMAL(12,2)   NOT NULL,
    valid_from          DATE            NOT NULL,
    valid_to            DATE            NOT NULL,
    PRIMARY KEY (policy_id),
    CONSTRAINT fk_policy_patient
        FOREIGN KEY (patient_id) REFERENCES PATIENT (patient_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. APPOINTMENT, CONSULTATION
-- ---------------------------------------------------------------------
CREATE TABLE APPOINTMENT (
    appointment_id  INT             NOT NULL AUTO_INCREMENT,
    patient_id      INT             NOT NULL,
    doctor_id       INT             NOT NULL,
    branch_id       INT             NOT NULL,
    room_id         INT             NULL,          -- not every visit uses a room
    appointment_date DATE           NOT NULL,
    scheduled_start TIME            NOT NULL,
    scheduled_end   TIME            NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'Scheduled',
    is_walkin       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (appointment_id),
    CONSTRAINT fk_appt_patient
        FOREIGN KEY (patient_id) REFERENCES PATIENT (patient_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_appt_doctor
        FOREIGN KEY (doctor_id) REFERENCES DOCTOR (doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_appt_branch
        FOREIGN KEY (branch_id) REFERENCES BRANCH (branch_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_appt_room
        FOREIGN KEY (room_id) REFERENCES ROOM (room_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One consultation per appointment (appointment_id is unique -> 02_constraints).
CREATE TABLE CONSULTATION (
    consultation_id INT             NOT NULL AUTO_INCREMENT,
    appointment_id  INT             NOT NULL,
    notes           VARCHAR(50)     NULL,
    diagnosis       VARCHAR(50)     NULL,
    recorded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (consultation_id),
    CONSTRAINT fk_consultation_appt
        FOREIGN KEY (appointment_id) REFERENCES APPOINTMENT (appointment_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. TREATMENT, APPT_TREATMENT
-- ---------------------------------------------------------------------
CREATE TABLE TREATMENT (
    treatment_id    INT             NOT NULL AUTO_INCREMENT,
    category_id     INT             NOT NULL,
    service_code    VARCHAR(20)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    price           DECIMAL(12,2)   NOT NULL,
    is_claimable    BOOLEAN         NOT NULL DEFAULT FALSE,
    PRIMARY KEY (treatment_id),
    CONSTRAINT fk_treatment_category
        FOREIGN KEY (category_id) REFERENCES TREATMENT_CATEGORY (category_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Line item: the treatments performed at an appointment. price_snapshot
-- freezes the price at the time of service.
CREATE TABLE APPT_TREATMENT (
    appt_treatment_id INT           NOT NULL AUTO_INCREMENT,
    appointment_id  INT             NOT NULL,
    treatment_id    INT             NOT NULL,
    price_snapshot  DECIMAL(12,2)   NOT NULL,
    PRIMARY KEY (appt_treatment_id),
    CONSTRAINT fk_appttreat_appt
        FOREIGN KEY (appointment_id) REFERENCES APPOINTMENT (appointment_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_appttreat_treatment
        FOREIGN KEY (treatment_id) REFERENCES TREATMENT (treatment_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 9. INVOICE, PAYMENT, INSURANCE_CLAIM
-- ---------------------------------------------------------------------
-- One invoice per appointment (appointment_id is unique -> 02_constraints).
CREATE TABLE INVOICE (
    invoice_id      INT             NOT NULL AUTO_INCREMENT,
    appointment_id  INT             NOT NULL,
    total_amount    DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    paid_amount     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    balance_due     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    status          VARCHAR(50)     NOT NULL DEFAULT 'Unpaid',
    PRIMARY KEY (invoice_id),
    CONSTRAINT fk_invoice_appt
        FOREIGN KEY (appointment_id) REFERENCES APPOINTMENT (appointment_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE PAYMENT (
    payment_id      INT             NOT NULL AUTO_INCREMENT,
    invoice_id      INT             NOT NULL,
    payment_date    DATE            NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    payment_method  VARCHAR(30)     NOT NULL,
    PRIMARY KEY (payment_id),
    CONSTRAINT fk_payment_invoice
        FOREIGN KEY (invoice_id) REFERENCES INVOICE (invoice_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE INSURANCE_CLAIM (
    claim_id        INT             NOT NULL AUTO_INCREMENT,
    policy_id       INT             NOT NULL,
    invoice_id      INT             NOT NULL,
    claimed_amount  DECIMAL(12,2)   NOT NULL,
    approved_amount DECIMAL(12,2)   NULL,           -- null until adjudicated
    status          VARCHAR(20)     NOT NULL DEFAULT 'Submitted',
    PRIMARY KEY (claim_id),
    CONSTRAINT fk_claim_policy
        FOREIGN KEY (policy_id) REFERENCES INSURANCE_POLICY (policy_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_claim_invoice
        FOREIGN KEY (invoice_id) REFERENCES INVOICE (invoice_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- End of 01_schema.sql - 17 tables created in dependency order.
-- Next: 02_constraints.sql (CHECK / UNIQUE), then 03_functions.sql ...
-- =====================================================================
