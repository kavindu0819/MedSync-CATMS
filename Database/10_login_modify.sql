INSERT INTO PATIENT_AUTH (patient_id, email, password_hash)
SELECT 
    patient_id,
    CONCAT('patient', patient_id, '@medsync.lk') AS email,
    '$2a$10$wE1VpS3M4mS2YxNn4kL/ee/2r3C9W6J7B3QzX9mK2L1vR3S4T5U6V' AS password_hash
FROM PATIENT;