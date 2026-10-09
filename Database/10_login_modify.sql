INSERT INTO PATIENT_AUTH (patient_id, email, password_hash)
SELECT 
    patient_id,
    CONCAT('patient', patient_id, '@medsync.lk') AS email,
    '$2b$10$KNduwiOvc0heZb304Wxs9OO82Qw4ZMF1Yx7D0RzGkSxCW8.nxN19O' AS password_hash
FROM PATIENT;