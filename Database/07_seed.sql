-- =====================================================================
-- MedSync CATMS  |  07_seed.sql
-- Dummy data  |  Plan owner: Sulakshana D.G  (drafted here on request)
--
-- Loads a realistic demonstration dataset:
--   * reference data (branches, staff, doctors, rooms, treatments...)
--   * 200 patients + emergency contacts + insurance policies
--   * 1000+ appointments with consultations, treatment lines, invoices,
--     payments and insurance claims
--
-- Generated with a temporary stored procedure so we get volume without
-- 1000 hand-written INSERTs. All triggers stay active during load:
--   * appointment slots are sequential per doctor/day => no double-booking
--   * payments flow through the payment trigger => invoices self-balance
--
-- Runs AFTER 01..06.
-- =====================================================================

USE medsync;

-- ---------------------------------------------------------------------
-- Reference data (explicit ids so the generator can map to them)
-- ---------------------------------------------------------------------

-- Specialties
INSERT INTO SPECIALTY (specialty_id, specialty_name, description) VALUES
    (1,'General Medicine','Primary care and general consultations'),
    (2,'Cardiology','Heart and cardiovascular care'),
    (3,'Dermatology','Skin, hair and nails'),
    (4,'Pediatrics','Child health'),
    (5,'Orthopedics','Bones and joints'),
    (6,'ENT','Ear, nose and throat');

-- Branches (manager_id added after STAFF exists)
INSERT INTO BRANCH (branch_id, manager_id, name, address, city, phone, email) VALUES
    (1, NULL, 'MedSync Colombo','12 Galle Rd','Colombo','0112345678','colombo@medsync.lk'),
    (2, NULL, 'MedSync Kandy','45 Peradeniya Rd','Kandy','0812345678','kandy@medsync.lk'),
    (3, NULL, 'MedSync Galle','7 Matara Rd','Galle','0912345678','galle@medsync.lk');

-- Staff: 3 managers (non-medical), 6 doctors, 3 support (medical/non-medical)
INSERT INTO STAFF (staff_id, branch_id, first_name, last_name, role, is_medical, phone, email) VALUES
    (1,1,'Nimal','Perera','Branch Manager',0,'0771000001','nimal.perera@medsync.lk'),
    (2,2,'Kamala','Silva','Branch Manager',0,'0771000002','kamala.silva@medsync.lk'),
    (3,3,'Sunil','Fernando','Branch Manager',0,'0771000003','sunil.fernando@medsync.lk'),
    (4,1,'Anushka','Jayawardena','Doctor',1,'0771000004','anushka.j@medsync.lk'),
    (5,1,'Ruwan','Bandara','Doctor',1,'0771000005','ruwan.b@medsync.lk'),
    (6,2,'Dilani','Wickrama','Doctor',1,'0771000006','dilani.w@medsync.lk'),
    (7,2,'Chaminda','Rathnayake','Doctor',1,'0771000007','chaminda.r@medsync.lk'),
    (8,3,'Sanduni','Gunasekara','Doctor',1,'0771000008','sanduni.g@medsync.lk'),
    (9,3,'Pradeep','Alwis','Doctor',1,'0771000009','pradeep.a@medsync.lk'),
    (10,1,'Malini','Dias','Nurse',1,'0771000010','malini.d@medsync.lk'),
    (11,2,'Tharindu','Peris','Receptionist',0,'0771000011','tharindu.p@medsync.lk'),
    (12,3,'Ishara','Kumari','Nurse',1,'0771000012','ishara.k@medsync.lk');

-- Assign one manager per branch (FR-BM-07)
UPDATE BRANCH SET manager_id = 1 WHERE branch_id = 1;
UPDATE BRANCH SET manager_id = 2 WHERE branch_id = 2;
UPDATE BRANCH SET manager_id = 3 WHERE branch_id = 3;

-- Doctors (doctor_id = staff_id)
INSERT INTO DOCTOR (doctor_id, branch_id, registration_no) VALUES
    (4,1,10004),(5,1,10005),(6,2,10006),(7,2,10007),(8,3,10008),(9,3,10009);

-- Each doctor gets one or two specialties
INSERT INTO DOCTOR_SPECIALTY (doctor_id, specialty_id) VALUES
    (4,1),(4,2),(5,3),(6,1),(6,4),(7,5),(8,1),(8,6),(9,5);

-- Rooms: ids 1-3 branch1, 4-6 branch2, 7-9 branch3
INSERT INTO ROOM (room_id, branch_id, room_number) VALUES
    (1,1,'C-101'),(2,1,'C-102'),(3,1,'C-103'),
    (4,2,'K-201'),(5,2,'K-202'),(6,2,'K-203'),
    (7,3,'G-301'),(8,3,'G-302'),(9,3,'G-303');

-- Treatment catalogue
INSERT INTO TREATMENT_CATEGORY (category_id, category_name) VALUES
    (1,'Consultation'),(2,'Laboratory'),(3,'Imaging'),(4,'Procedure'),(5,'Pharmacy');

INSERT INTO TREATMENT (treatment_id, category_id, service_code, name, price, is_claimable) VALUES
    (1,1,'T001','General Consultation',2000.00,1),
    (2,1,'T002','Specialist Consultation',3500.00,1),
    (3,2,'T003','Full Blood Count',1500.00,1),
    (4,2,'T004','Urine Analysis',800.00,1),
    (5,2,'T005','Lipid Profile',2500.00,1),
    (6,3,'T006','X-Ray',3000.00,1),
    (7,3,'T007','Ultrasound Scan',4500.00,1),
    (8,3,'T008','MRI Scan',15000.00,1),
    (9,4,'T009','Minor Surgery',12000.00,1),
    (10,4,'T010','Wound Dressing',1000.00,1),
    (11,4,'T011','ECG',2200.00,1),
    (12,5,'T012','Antibiotics Course',1200.00,0),
    (13,5,'T013','Painkillers',600.00,0),
    (14,5,'T014','Vitamin Supplements',900.00,0),
    (15,5,'T015','Cosmetic Cream',2000.00,0);

-- ---------------------------------------------------------------------
-- Generator procedure: patients + 1000+ appointments and downstream
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_seed_generate;

DELIMITER $$

CREATE PROCEDURE sp_seed_generate()
BEGIN
    DECLARE v_p        INT;
    DECLARE v_i        INT DEFAULT 0;
    DECLARE v_day      INT;
    DECLARE v_doc      INT;
    DECLARE v_slot     INT;
    DECLARE v_branch   INT;
    DECLARE v_room     INT;
    DECLARE v_patient  INT;
    DECLARE v_appt     INT;
    DECLARE v_invoice  INT;
    DECLARE v_policy   INT;
    DECLARE v_status   VARCHAR(20);
    DECLARE v_walkin   BOOLEAN;
    DECLARE v_date     DATE;
    DECLARE v_start    TIME;
    DECLARE v_end      TIME;
    DECLARE v_total    DECIMAL(12,2);
    DECLARE v_cov      DECIMAL(12,2);
    DECLARE v_out      DECIMAL(12,2);
    DECLARE v_t1       INT;
    DECLARE v_t2       INT;
    DECLARE v_p1       DECIMAL(12,2);
    DECLARE v_p2       DECIMAL(12,2);
    DECLARE v_pay      DECIMAL(12,2);
    DECLARE v_method   VARCHAR(30);
    DECLARE v_scenario INT;

    -- ---- 200 patients, each with an emergency contact; ~60% insured ----
    SET v_p = 1;
    WHILE v_p <= 200 DO
        INSERT INTO PATIENT (patient_id, nic, guardian_nic, first_name, last_name, dob, gender, address, phone)
        VALUES (
            v_p,
            CONCAT('NIC', LPAD(v_p, 7, '0')),
            NULL,
            CONCAT('Patient', v_p),
            CONCAT('Family', (v_p % 40) + 1),
            DATE_ADD('1965-01-01', INTERVAL (v_p * 97 MOD 18250) DAY),
            IF(v_p % 2 = 0, 'Female', 'Male'),
            CONCAT((v_p MOD 300) + 1, ' Main Street'),
            CONCAT('07', LPAD((v_p * 13) MOD 100000000, 8, '0'))
        );

        INSERT INTO EMERGENCY_CONTACT (patient_id, name, relationship, phone)
        VALUES (
            v_p,
            CONCAT('Contact', v_p),
            ELT((v_p % 4) + 1, 'Spouse', 'Parent', 'Sibling', 'Child'),
            CONCAT('07', LPAD((v_p * 29) MOD 100000000, 8, '0'))
        );

        IF (v_p % 10) < 6 THEN
            INSERT INTO INSURANCE_POLICY
                (patient_id, provider_name, policy_no, coverage_percentage, annual_ceiling, valid_from, valid_to)
            VALUES (
                v_p,
                ELT((v_p % 4) + 1, 'Ceylinco', 'AIA', 'Allianz', 'Union'),
                CONCAT('POL', LPAD(v_p, 6, '0')),
                ELT((v_p % 4) + 1, 50.00, 70.00, 80.00, 90.00),
                100000.00 * ((v_p % 5) + 1),
                '2024-01-01',
                '2026-12-31'
            );
        END IF;

        SET v_p = v_p + 1;
    END WHILE;

    -- ---- Appointments: 30 days x 6 doctors x 6 slots = 1080 ----
    SET v_day = 0;
    WHILE v_day < 30 DO
        SET v_doc = 4;
        WHILE v_doc <= 9 DO
            SELECT branch_id INTO v_branch FROM DOCTOR WHERE doctor_id = v_doc;

            SET v_slot = 0;
            WHILE v_slot < 6 DO
                SET v_date    = DATE_ADD('2025-01-06', INTERVAL v_day DAY);
                SET v_start   = SEC_TO_TIME(8*3600 + v_slot*1800);        -- 08:00, 08:30, ...
                SET v_end     = SEC_TO_TIME(8*3600 + v_slot*1800 + 1800);
                SET v_room    = (v_branch - 1) * 3 + 1 + (v_slot MOD 3);   -- a room in that branch
                SET v_patient = 1 + (v_i MOD 200);
                SET v_walkin  = (v_i % 7 = 0);
                SET v_status  = CASE
                                    WHEN v_i % 20 = 0        THEN 'Cancelled'
                                    WHEN v_i % 20 IN (1,2)   THEN 'Scheduled'
                                    ELSE 'Completed'
                                END;

                -- Insert as Scheduled first, then move to final status so the
                -- audit trigger records the change (realistic history).
                INSERT INTO APPOINTMENT
                    (patient_id, doctor_id, branch_id, room_id,
                     appointment_date, scheduled_start, scheduled_end, status, is_walkin)
                VALUES
                    (v_patient, v_doc, v_branch, v_room,
                     v_date, v_start, v_end, 'Scheduled', v_walkin);
                SET v_appt = LAST_INSERT_ID();

                IF v_status = 'Cancelled' THEN
                    UPDATE APPOINTMENT SET status = 'Cancelled' WHERE appointment_id = v_appt;

                ELSEIF v_status = 'Completed' THEN
                    UPDATE APPOINTMENT SET status = 'Completed' WHERE appointment_id = v_appt;

                    -- consultation
                    INSERT INTO CONSULTATION (appointment_id, notes, diagnosis)
                    VALUES (
                        v_appt,
                        'Patient examined; advice given',
                        ELT((v_i % 6) + 1, 'Hypertension', 'Type 2 Diabetes', 'Viral Infection',
                                           'Fracture', 'Dermatitis', 'Routine Checkup')
                    );

                    -- one or two treatment lines
                    SET v_t1 = 1 + (v_i % 15);
                    SELECT price INTO v_p1 FROM TREATMENT WHERE treatment_id = v_t1;
                    INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                    VALUES (v_appt, v_t1, v_p1);

                    IF v_i % 3 = 0 THEN
                        SET v_t2 = 1 + ((v_i + 7) % 15);
                        IF v_t2 <> v_t1 THEN
                            SELECT price INTO v_p2 FROM TREATMENT WHERE treatment_id = v_t2;
                            INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                            VALUES (v_appt, v_t2, v_p2);
                        END IF;
                    END IF;

                    -- invoice
                    SET v_total = fn_treatment_charges(v_appt);
                    INSERT INTO INVOICE (appointment_id, total_amount, paid_amount, balance_due, status)
                    VALUES (v_appt, v_total, 0.00, v_total, 'Unpaid');
                    SET v_invoice = LAST_INSERT_ID();

                    -- insurance claim if the patient has a valid policy
                    SET v_policy = NULL;
                    SELECT policy_id INTO v_policy
                    FROM INSURANCE_POLICY
                    WHERE patient_id = v_patient
                      AND v_date BETWEEN valid_from AND valid_to
                    ORDER BY coverage_percentage DESC
                    LIMIT 1;

                    SET v_cov = 0.00;
                    IF v_policy IS NOT NULL THEN
                        SET v_cov = fn_insurance_coverage(v_invoice);
                        IF v_cov > 0 THEN
                            INSERT INTO INSURANCE_CLAIM
                                (policy_id, invoice_id, claimed_amount, approved_amount, status)
                            VALUES (v_policy, v_invoice, v_cov, v_cov, 'Approved');
                        END IF;
                    END IF;

                    -- settle the invoice: mix of paid / partially paid / unpaid
                    SET v_out    = fn_outstanding_balance(v_invoice);
                    SET v_method = ELT((v_i % 3) + 1, 'Cash', 'Card', 'Insurance');

                    IF v_out <= 0 THEN
                        UPDATE INVOICE SET balance_due = 0.00, status = 'Paid'
                        WHERE invoice_id = v_invoice;
                    ELSE
                        SET v_scenario = v_i % 10;
                        IF v_scenario IN (0,1) THEN
                            -- leave unpaid, but reflect insurance on the balance
                            UPDATE INVOICE SET balance_due = v_out, status = 'Unpaid'
                            WHERE invoice_id = v_invoice;
                        ELSEIF v_scenario = 2 THEN
                            SET v_pay = ROUND(v_out / 2, 2);
                            IF v_pay <= 0 THEN SET v_pay = v_out; END IF;
                            INSERT INTO PAYMENT (invoice_id, payment_date, amount, payment_method)
                            VALUES (v_invoice, v_date, v_pay, v_method);
                        ELSE
                            INSERT INTO PAYMENT (invoice_id, payment_date, amount, payment_method)
                            VALUES (v_invoice, v_date, v_out, v_method);
                        END IF;
                    END IF;
                END IF;

                SET v_slot = v_slot + 1;
                SET v_i    = v_i + 1;
            END WHILE;

            SET v_doc = v_doc + 1;
        END WHILE;

        SET v_day = v_day + 1;
    END WHILE;
END$$

DELIMITER ;

CALL sp_seed_generate();
DROP PROCEDURE sp_seed_generate;

-- =====================================================================
-- End of 07_seed.sql
-- =====================================================================
