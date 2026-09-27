-- =====================================================================
-- MedSync CATMS  |  09_seed_history.sql
-- Realistic history: September 2025 -> September 2026
-- Owner: Jayalath K.D / Database Layer   (extends 07_seed.sql)
--
-- 07_seed.sql builds its 1080 appointments from repeating patterns
-- (v_i % 20, v_i % 15 ...), so every doctor, day and branch looks the
-- same and every chart is flat. This file adds a year of varied data:
--
--   * 600 more patients (ids 201-800) with realistic Sri Lankan names,
--     ~55% insured, and gives the original 200 patients real names too
--   * ~13 months of appointments with:
--       - busier/quieter branches and doctors
--       - weekday pattern (Sundays: Colombo only, half load)
--       - public holidays closed, April New Year dip, December dip
--       - monsoon (Jun, Oct-Nov) peaks in viral fever / dengue
--       - ~20% growth across the year, occasional doctor leave days
--   * consultations, 1-4 treatment lines chosen by doctor specialty,
--     a price rise from January 2026
--   * invoices, insurance claims (Approved / Submitted / Rejected),
--     and payments that get less complete the more recent the visit
--
-- Deterministic: randomness comes from a seeded generator
-- (fn_seed_rand), so every teammate's database gets identical data.
--
-- Appointments before 2026-09-28 are Completed or Cancelled; from
-- 2026-09-28 onwards they are Scheduled (upcoming bookings).
--
-- All triggers stay active: slots are unique per doctor/day (no
-- double-booking), status changes go through UPDATE (audit rows), and
-- payments go through the payment trigger (invoices self-balance).
--
-- Safe to re-run: it does nothing if appointments already exist from
-- 2025-09-01 onwards. Everything runs in one transaction and rolls back
-- on any error, so a failed run leaves the database unchanged.
--
-- Apply to a running database without wiping it (as root: creating the
-- helper function needs SUPER while binary logging is on, which the
-- medsync_app user does not have):
--   docker exec -i medsync-mysql mysql -uroot -pmedsync_root medsync < Database/09_seed_history.sql
--
-- Runs AFTER 01..08.
-- =====================================================================

USE medsync;

DROP FUNCTION  IF EXISTS fn_seed_rand;
DROP PROCEDURE IF EXISTS sp_seed_history;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Seeded pseudo-random number in [0, 1)
--   Linear congruential generator over the session variable @seed.
--   MySQL's RAND() cannot be seeded once for a whole procedure, and an
--   unseeded RAND() would give every teammate different data.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_seed_rand()
    RETURNS DOUBLE
    NOT DETERMINISTIC
    NO SQL
BEGIN
    SET @seed = (@seed * 1103515245 + 12345) MOD 2147483648;
    RETURN @seed / 2147483648;
END$$

CREATE PROCEDURE sp_seed_history()
main: BEGIN
    DECLARE v_date      DATE;
    DECLARE v_end_date  DATE DEFAULT '2026-09-30';
    DECLARE v_cutoff    DATE DEFAULT '2026-09-28';   -- "today" for the dataset
    DECLARE v_dow       INT;
    DECLARE v_month     INT;
    DECLARE v_day_no    INT DEFAULT 0;
    DECLARE v_doc       INT;
    DECLARE v_branch    INT;
    DECLARE v_slot      INT;
    DECLARE v_p         INT;
    DECLARE v_gender    VARCHAR(10);
    DECLARE v_first     VARCHAR(50);
    DECLARE v_last      VARCHAR(50);

    DECLARE f_season    DOUBLE;
    DECLARE f_weekday   DOUBLE;
    DECLARE f_branch    DOUBLE;
    DECLARE f_doctor    DOUBLE;
    DECLARE f_growth    DOUBLE;
    DECLARE v_prob      DOUBLE;
    DECLARE v_r         DOUBLE;

    DECLARE v_patient   INT;
    DECLARE v_room      INT;
    DECLARE v_start     TIME;
    DECLARE v_end       TIME;
    DECLARE v_walkin    BOOLEAN;
    DECLARE v_status    VARCHAR(20);
    DECLARE v_appt      INT;
    DECLARE v_diag      VARCHAR(100);
    DECLARE v_price_f   DOUBLE;
    DECLARE v_t         INT;
    DECLARE v_invoice   INT;
    DECLARE v_total     DECIMAL(12,2);
    DECLARE v_policy    INT;
    DECLARE v_cov       DECIMAL(12,2);
    DECLARE v_out       DECIMAL(12,2);
    DECLARE v_pay       DECIMAL(12,2);
    DECLARE v_pay_date  DATE;
    DECLARE v_method    VARCHAR(30);
    DECLARE v_age_days  INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Re-run guard
    IF EXISTS (SELECT 1 FROM APPOINTMENT WHERE appointment_date >= '2025-09-01') THEN
        SELECT 'History already loaded - nothing to do' AS info;
        LEAVE main;
    END IF;

    SET @seed = 20250901;
    START TRANSACTION;

    -- -----------------------------------------------------------------
    -- Real names for the original 200 patients (gender kept as-is)
    -- -----------------------------------------------------------------
    SET v_p = 1;
    WHILE v_p <= 200 DO
        SELECT gender INTO v_gender FROM PATIENT WHERE patient_id = v_p;
        IF v_gender = 'Female' THEN
            SET v_first = ELT(FLOOR(fn_seed_rand() * 16) + 1,
                'Chamari','Dilini','Nadeesha','Ishara','Kavindi','Sachini','Thilini','Madhavi',
                'Anjali','Priyanka','Fathima','Hiruni','Sewwandi','Nimali','Oshadi','Tharushi');
        ELSE
            SET v_first = ELT(FLOOR(fn_seed_rand() * 16) + 1,
                'Kasun','Nuwan','Tharindu','Sanjeewa','Ruwan','Harsha','Pradeep','Lahiru',
                'Dinesh','Suresh','Mohamed','Rajesh','Chathura','Janaka','Asanka','Vishwa');
        END IF;
        SET v_last = ELT(FLOOR(fn_seed_rand() * 24) + 1,
            'Perera','Fernando','Silva','Jayasuriya','Wickramasinghe','Bandara','Rathnayake',
            'Gunawardena','Dissanayake','Herath','Karunaratne','Wijesinghe','Senanayake','Kumara',
            'Rajapaksha','Liyanage','Ranasinghe','Abeysekara','Mendis','Samarasinghe',
            'Nanayakkara','Weerasinghe','Hettiarachchi','Ekanayake');
        UPDATE PATIENT SET first_name = v_first, last_name = v_last WHERE patient_id = v_p;
        SET v_p = v_p + 1;
    END WHILE;

    -- -----------------------------------------------------------------
    -- 600 new patients (201-800), ~55% insured
    -- -----------------------------------------------------------------
    SET v_p = 201;
    WHILE v_p <= 800 DO
        IF fn_seed_rand() < 0.52 THEN
            SET v_gender = 'Female';
            SET v_first = ELT(FLOOR(fn_seed_rand() * 16) + 1,
                'Chamari','Dilini','Nadeesha','Ishara','Kavindi','Sachini','Thilini','Madhavi',
                'Anjali','Priyanka','Fathima','Hiruni','Sewwandi','Nimali','Oshadi','Tharushi');
        ELSE
            SET v_gender = 'Male';
            SET v_first = ELT(FLOOR(fn_seed_rand() * 16) + 1,
                'Kasun','Nuwan','Tharindu','Sanjeewa','Ruwan','Harsha','Pradeep','Lahiru',
                'Dinesh','Suresh','Mohamed','Rajesh','Chathura','Janaka','Asanka','Vishwa');
        END IF;
        SET v_last = ELT(FLOOR(fn_seed_rand() * 24) + 1,
            'Perera','Fernando','Silva','Jayasuriya','Wickramasinghe','Bandara','Rathnayake',
            'Gunawardena','Dissanayake','Herath','Karunaratne','Wijesinghe','Senanayake','Kumara',
            'Rajapaksha','Liyanage','Ranasinghe','Abeysekara','Mendis','Samarasinghe',
            'Nanayakkara','Weerasinghe','Hettiarachchi','Ekanayake');

        INSERT INTO PATIENT (patient_id, nic, guardian_nic, first_name, last_name, dob, gender, address, phone)
        VALUES (
            v_p,
            CONCAT('NIC', LPAD(v_p, 7, '0')),
            NULL,
            v_first,
            v_last,
            DATE_ADD('1945-01-01', INTERVAL FLOOR(fn_seed_rand() * 27000) DAY),
            v_gender,
            CONCAT(FLOOR(fn_seed_rand() * 400) + 1, ' ',
                   ELT(FLOOR(fn_seed_rand() * 8) + 1, 'Galle Rd','Kandy Rd','Temple Rd','Lake Rd',
                       'Station Rd','Hospital Rd','Church St','Main St'),
                   ', ',
                   ELT(FLOOR(fn_seed_rand() * 6) + 1, 'Colombo','Dehiwala','Kandy','Peradeniya',
                       'Galle','Matara')),
            CONCAT('07', FLOOR(fn_seed_rand() * 8) + 0, LPAD(FLOOR(fn_seed_rand() * 10000000), 7, '0'))
        );

        INSERT INTO EMERGENCY_CONTACT (patient_id, name, relationship, phone)
        VALUES (
            v_p,
            CONCAT(ELT(FLOOR(fn_seed_rand() * 8) + 1, 'Nimal','Kamala','Sunil','Anoma',
                       'Saman','Rohini','Mahesh','Deepika'), ' ', v_last),
            ELT(FLOOR(fn_seed_rand() * 4) + 1, 'Spouse','Parent','Sibling','Child'),
            CONCAT('07', FLOOR(fn_seed_rand() * 8), LPAD(FLOOR(fn_seed_rand() * 10000000), 7, '0'))
        );

        IF fn_seed_rand() < 0.55 THEN
            INSERT INTO INSURANCE_POLICY
                (patient_id, provider_name, policy_no, coverage_percentage, annual_ceiling, valid_from, valid_to)
            VALUES (
                v_p,
                ELT(FLOOR(fn_seed_rand() * 5) + 1, 'Ceylinco','AIA','Allianz','Union','HNB Assurance'),
                CONCAT('POL', LPAD(v_p, 6, '0')),
                ELT(FLOOR(fn_seed_rand() * 5) + 1, 50.00, 60.00, 70.00, 80.00, 90.00),
                100000.00 * (FLOOR(fn_seed_rand() * 5) + 1),
                '2025-01-01',
                '2027-12-31'
            );
        END IF;

        SET v_p = v_p + 1;
    END WHILE;

    -- -----------------------------------------------------------------
    -- Appointments, day by day
    -- -----------------------------------------------------------------
    SET v_date = '2025-09-01';
    WHILE v_date <= v_end_date DO
        SET v_dow   = DAYOFWEEK(v_date);          -- 1 = Sunday ... 7 = Saturday
        SET v_month = MONTH(v_date);

        -- Seasonal demand
        SET f_season = ELT(v_month,
            1.00,   -- Jan
            0.95,   -- Feb
            1.00,   -- Mar
            0.72,   -- Apr  (Sinhala & Tamil New Year)
            0.95,   -- May
            1.15,   -- Jun  (south-west monsoon, dengue)
            1.05,   -- Jul
            0.95,   -- Aug
            1.00,   -- Sep
            1.10,   -- Oct  (inter-monsoon)
            1.15,   -- Nov  (north-east monsoon)
            0.80);  -- Dec  (holidays)

        -- Gradual growth, ~20% across the year
        SET f_growth = 0.90 + 0.20 * v_day_no / 395;

        SET v_doc = 4;
        WHILE v_doc <= 9 DO
            SET v_branch = CASE WHEN v_doc <= 5 THEN 1 WHEN v_doc <= 7 THEN 2 ELSE 3 END;

            -- Closed days: public holidays, Sundays outside Colombo
            IF DATE_FORMAT(v_date, '%m-%d') IN ('12-25', '01-01', '02-04', '04-13', '04-14', '05-01')
               OR (v_dow = 1 AND v_branch <> 1) THEN
                SET v_prob = 0;
            ELSE
                SET f_weekday = CASE v_dow
                                    WHEN 1 THEN 0.45   -- Sunday (Colombo only)
                                    WHEN 2 THEN 1.15   -- Monday rush
                                    WHEN 7 THEN 0.70   -- Saturday
                                    ELSE 1.00
                                END;
                SET f_branch = ELT(v_branch, 1.00, 0.82, 0.68);
                SET f_doctor = ELT(v_doc - 3, 1.10, 0.85, 1.00, 0.90, 0.88, 1.08);
                SET v_prob   = 0.62 * f_season * f_weekday * f_branch * f_doctor * f_growth;
                IF v_prob > 0.95 THEN SET v_prob = 0.95; END IF;

                -- Occasional leave day
                IF fn_seed_rand() < 0.04 THEN SET v_prob = 0; END IF;
            END IF;

            -- 14 half-hour slots: 08:00 ... 14:30
            SET v_slot = 0;
            WHILE v_slot < 14 DO
                IF v_prob > 0 AND fn_seed_rand() < v_prob THEN

                    SET v_start   = SEC_TO_TIME(8*3600 + v_slot*1800);
                    SET v_end     = SEC_TO_TIME(8*3600 + v_slot*1800 + 1800);
                    SET v_room    = (v_branch - 1) * 3 + 1
                                    + IF(fn_seed_rand() < 0.12, 2, IF(v_doc % 2 = 0, 0, 1));
                    SET v_patient = FLOOR(fn_seed_rand() * 800) + 1;
                    SET v_walkin  = fn_seed_rand() < 0.15;

                    IF v_date < v_cutoff THEN
                        SET v_status = IF(fn_seed_rand() < 0.06 + 0.04 * (v_dow = 2), 'Cancelled', 'Completed');
                    ELSE
                        SET v_status = IF(fn_seed_rand() < 0.04, 'Cancelled', 'Scheduled');
                    END IF;

                    -- Insert as Scheduled, then move to the final status so the
                    -- audit trigger records the change (same as 07_seed.sql).
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

                        -- ---- Consultation, diagnosis follows the season ----
                        SET v_r = fn_seed_rand();
                        IF v_month IN (6, 10, 11) AND v_r < 0.30 THEN
                            SET v_diag = ELT(FLOOR(fn_seed_rand() * 3) + 1,
                                             'Dengue Fever', 'Viral Fever', 'Upper Respiratory Infection');
                        ELSEIF v_doc = 5 THEN
                            SET v_diag = ELT(FLOOR(fn_seed_rand() * 4) + 1,
                                             'Dermatitis', 'Eczema', 'Acne', 'Fungal Infection');
                        ELSEIF v_doc IN (7, 9) THEN
                            SET v_diag = ELT(FLOOR(fn_seed_rand() * 4) + 1,
                                             'Fracture', 'Back Pain', 'Osteoarthritis', 'Sprain');
                        ELSE
                            SET v_diag = ELT(FLOOR(fn_seed_rand() * 10) + 1,
                                             'Hypertension', 'Type 2 Diabetes', 'Viral Fever', 'Gastritis',
                                             'Allergic Rhinitis', 'Asthma', 'Migraine', 'Otitis Media',
                                             'Routine Checkup', 'Upper Respiratory Infection');
                        END IF;

                        INSERT INTO CONSULTATION (appointment_id, notes, diagnosis)
                        VALUES (v_appt,
                                ELT(FLOOR(fn_seed_rand() * 4) + 1,
                                    'Patient examined; advice given',
                                    'Follow-up in two weeks',
                                    'Medication prescribed; review if symptoms persist',
                                    'Investigations ordered'),
                                v_diag);

                        -- ---- Treatment lines (price rise from Jan 2026) ----
                        SET v_price_f = IF(v_date >= '2026-01-01', 1.08, 1.00);

                        -- Consultation fee: specialists charge more
                        IF v_doc IN (5, 7, 9) THEN
                            SET v_t = IF(fn_seed_rand() < 0.75, 2, 1);
                        ELSE
                            SET v_t = IF(fn_seed_rand() < 0.30, 2, 1);
                        END IF;
                        INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                        SELECT v_appt, treatment_id, ROUND(price * v_price_f, -1)
                        FROM TREATMENT WHERE treatment_id = v_t;

                        -- Laboratory
                        IF fn_seed_rand() < IF(v_doc IN (4, 6, 8), 0.38, 0.18) THEN
                            SET v_r = fn_seed_rand();
                            SET v_t = IF(v_r < 0.50, 3, IF(v_r < 0.75, 4, 5));
                            INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                            SELECT v_appt, treatment_id, ROUND(price * v_price_f, -1)
                            FROM TREATMENT WHERE treatment_id = v_t;
                        END IF;

                        -- Imaging: orthopaedics order far more
                        IF fn_seed_rand() < IF(v_doc IN (7, 9), 0.45, 0.10) THEN
                            SET v_r = fn_seed_rand();
                            SET v_t = IF(v_r < 0.62, 6, IF(v_r < 0.92, 7, 8));
                            INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                            SELECT v_appt, treatment_id, ROUND(price * v_price_f, -1)
                            FROM TREATMENT WHERE treatment_id = v_t;
                        END IF;

                        -- Procedures: ECG mostly cardiology (doctor 4)
                        IF fn_seed_rand() < IF(v_doc = 4, 0.25, 0.08) THEN
                            SET v_r = fn_seed_rand();
                            IF v_doc = 4 THEN
                                SET v_t = IF(v_r < 0.80, 11, 10);
                            ELSE
                                SET v_t = IF(v_r < 0.60, 10, IF(v_r < 0.80, 11, 9));
                            END IF;
                            INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                            SELECT v_appt, treatment_id, ROUND(price * v_price_f, -1)
                            FROM TREATMENT WHERE treatment_id = v_t;
                        END IF;

                        -- Pharmacy: dermatology sells cosmetic cream
                        IF fn_seed_rand() < 0.58 THEN
                            SET v_r = fn_seed_rand();
                            IF v_doc = 5 AND v_r < 0.50 THEN
                                SET v_t = 15;
                            ELSE
                                SET v_t = ELT(FLOOR(fn_seed_rand() * 3) + 1, 12, 13, 14);
                            END IF;
                            INSERT INTO APPT_TREATMENT (appointment_id, treatment_id, price_snapshot)
                            SELECT v_appt, treatment_id, ROUND(price * v_price_f, -1)
                            FROM TREATMENT WHERE treatment_id = v_t;
                        END IF;

                        -- ---- Invoice ----
                        SET v_total = fn_treatment_charges(v_appt);
                        INSERT INTO INVOICE (appointment_id, total_amount, paid_amount, balance_due, status)
                        VALUES (v_appt, v_total, 0.00, v_total, 'Unpaid');
                        SET v_invoice = LAST_INSERT_ID();

                        SET v_age_days = DATEDIFF(v_cutoff, v_date);

                        -- ---- Insurance claim ----
                        SET v_policy = NULL;
                        SELECT policy_id INTO v_policy
                        FROM INSURANCE_POLICY
                        WHERE patient_id = v_patient
                          AND v_date BETWEEN valid_from AND valid_to
                        ORDER BY coverage_percentage DESC
                        LIMIT 1;

                        IF v_policy IS NOT NULL THEN
                            SET v_cov = fn_insurance_coverage(v_invoice);
                            IF v_cov > 0 THEN
                                SET v_r = fn_seed_rand();
                                IF v_age_days < 21 AND v_r < 0.60 THEN
                                    -- recent claims are still being processed
                                    INSERT INTO INSURANCE_CLAIM
                                        (policy_id, invoice_id, claimed_amount, approved_amount, status)
                                    VALUES (v_policy, v_invoice, v_cov, NULL, 'Submitted');
                                ELSEIF v_r < 0.08 THEN
                                    INSERT INTO INSURANCE_CLAIM
                                        (policy_id, invoice_id, claimed_amount, approved_amount, status)
                                    VALUES (v_policy, v_invoice, v_cov, 0.00, 'Rejected');
                                ELSE
                                    INSERT INTO INSURANCE_CLAIM
                                        (policy_id, invoice_id, claimed_amount, approved_amount, status)
                                    VALUES (v_policy, v_invoice, v_cov, v_cov, 'Approved');
                                END IF;
                            END IF;
                        END IF;

                        -- ---- Payment: recent visits are more often unpaid ----
                        SET v_out = fn_outstanding_balance(v_invoice);

                        IF v_out <= 0 THEN
                            UPDATE INVOICE SET balance_due = 0.00, status = 'Paid'
                            WHERE invoice_id = v_invoice;
                        ELSE
                            SET v_r = fn_seed_rand();
                            SET v_method = IF(fn_seed_rand() < 0.45, 'Cash',
                                           IF(fn_seed_rand() < 0.70, 'Card', 'Bank Transfer'));
                            SET v_pay_date = IF(v_walkin OR v_method = 'Cash', v_date,
                                                DATE_ADD(v_date, INTERVAL FLOOR(fn_seed_rand() * 10) DAY));
                            IF v_pay_date >= v_cutoff THEN SET v_pay_date = v_date; END IF;

                            IF v_r < CASE WHEN v_age_days < 14 THEN 0.40
                                          WHEN v_age_days < 60 THEN 0.14
                                          ELSE 0.04 END THEN
                                -- unpaid: balance still reflects any approved insurance
                                UPDATE INVOICE SET balance_due = v_out, status = 'Unpaid'
                                WHERE invoice_id = v_invoice;
                            ELSEIF v_r > 0.90 THEN
                                -- partial payment
                                SET v_pay = ROUND(v_out * (0.30 + 0.40 * fn_seed_rand()), -1);
                                IF v_pay <= 0 OR v_pay >= v_out THEN SET v_pay = ROUND(v_out / 2, 2); END IF;
                                INSERT INTO PAYMENT (invoice_id, payment_date, amount, payment_method)
                                VALUES (v_invoice, v_pay_date, v_pay, v_method);
                            ELSE
                                INSERT INTO PAYMENT (invoice_id, payment_date, amount, payment_method)
                                VALUES (v_invoice, v_pay_date, v_out, v_method);
                            END IF;
                        END IF;
                    END IF;
                END IF;

                SET v_slot = v_slot + 1;
            END WHILE;

            SET v_doc = v_doc + 1;
        END WHILE;

        SET v_date   = DATE_ADD(v_date, INTERVAL 1 DAY);
        SET v_day_no = v_day_no + 1;
    END WHILE;

    COMMIT;
END$$

DELIMITER ;

CALL sp_seed_history();

DROP PROCEDURE sp_seed_history;
DROP FUNCTION  fn_seed_rand;

-- =====================================================================
-- End of 09_seed_history.sql
-- =====================================================================
