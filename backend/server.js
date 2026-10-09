require('dotenv').config();
const express = require('express');
const pool = require('./docker_connect'); // Imports your database connection pool

const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

// Middleware to parse incoming JSON bodies
app.use(express.json());

// ----------------------------------------------------
// 1. PATIENT ENDPOINTS
// ----------------------------------------------------

// GET all patients
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM PATIENT;');
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching patients:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single patient by ID
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM PATIENT WHERE patient_id = ?;', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching patient:', error.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// POST /api/patients - Create a new patient
app.post('/api/patients', async (req, res) => {
  try {
    // 1. Destructure patient fields from request body
    // (Adjust these field names to match your PATIENT table column names exactly)
    const { nic,guardian_nic = null,first_name,last_name,dob,gender,address = null ,phone=null,} = req.body;

    // 2. Validate basic input
    if (!nic || !first_name || !last_name || !dob || !gender) {
      return res.status(400).json({
        success: false,
        message: 'All required fields : nic, first_name, last_name, dob, gender are required.'
      });
    }

    // 3. Insert record using a parameterized SQL query
    const sql = `
      INSERT INTO PATIENT (nic, guardian_nic, first_name, last_name, dob, gender, address, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [result] = await pool.query(sql, [
      nic,
      guardian_nic,
      first_name,
      last_name,
      dob,
      gender,
      address,
      phone
    ]);

    // 4. Respond with the auto-generated ID
    res.status(201).json({
      success: true,
      message: 'Patient registered successfully!',
      patientId: result.insertId
    });

  } catch (error) {
    console.error('Error creating patient:', error.message);
    res.status(500).json({
      success: false,
      error: error.message 
    });
  }
});
// ----------------------------------------------------
// 2. DOCTOR ENDPOINTS
// ----------------------------------------------------

// GET all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM DOCTOR;');
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('Error fetching doctors:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single doctor by ID
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM DOCTOR WHERE doctor_id = ?;', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching doctor:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start listening on port 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

//--------------------------------------------------------
//            Appointments
//--------------------------------------------------------


// GET /api/appointments - Fetch all appointments with Patient and Doctor names
app.get('/api/appointments', async (req, res) => {
  try {
    const sql = `
      SELECT 
        a.appointment_id,
        a.appointment_date,
        a.scheduled_start,
        a.scheduled_end,
        a.status,
        a.is_walkin,
        p.patient_id,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        d.doctor_id,
        CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
        b.name AS branch_name
      FROM APPOINTMENT a
      JOIN PATIENT p ON a.patient_id = p.patient_id
      JOIN DOCTOR d ON a.doctor_id = d.doctor_id
      JOIN STAFF s ON d.doctor_id = s.staff_id
      JOIN BRANCH b ON a.branch_id = b.branch_id
      ORDER BY a.appointment_date DESC, a.scheduled_start ASC;
    `;

    const [rows] = await pool.query(sql);
    res.status(200).json(rows);

  } catch (error) {
    console.error('Error fetching appointments:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// book a new appoimentment
//post /api/appointments - Create a new appointment
// POST /api/appointments
app.post('/api/appointments', async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      branch_id,
      room_id = null,
      appointment_date,
      scheduled_start, // Using standard schema name
      scheduled_end,   // Using standard schema name
      status = 'Scheduled',
      is_walkin = false
    } = req.body;

    // Check required fields
    if (!patient_id || !doctor_id || !branch_id || !appointment_date || !scheduled_start || !scheduled_end) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: patient_id, doctor_id, branch_id, appointment_date, scheduled_start, and scheduled_end are required.'
      });
    }

    const sql = `
      INSERT INTO APPOINTMENT 
        (patient_id, doctor_id, branch_id, room_id, appointment_date, scheduled_start, scheduled_end, status, is_walkin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [result] = await pool.query(sql, [
      patient_id,
      doctor_id,
      branch_id,
      room_id,
      appointment_date,
      scheduled_start,
      scheduled_end,
      status,
      is_walkin
    ]);

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      appointmentId: result.insertId
    });

  } catch (error) {
    console.error('Error booking appointment:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM v_dashboard_summary');
    res.json(rows[0]);                    // single object, not an array
  } catch (e) {
    console.error('Error fetching dashboard summary:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/reports/branch-appointments', async (req, res) => {
  try {
    const { branchId, month } = req.query;

    if (!branchId) {
      return res.status(400).json({ success: false, error: 'branchId is required' });
    }

    let sql;
    let params;

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'month must look like 2025-01' });
      }
      // one calendar month
      sql = `SELECT date, scheduled, completed, cancelled, appointment_count
             FROM v_branch_appointments
             WHERE branch_id = ?
               AND date >= ?
               AND date < DATE(?) + INTERVAL 1 MONTH
             ORDER BY date`;
      params = [branchId, `${month}-01`, `${month}-01`];
    } else {
      // last 30 days, ending at the newest date with data
      sql = `SELECT date, scheduled, completed, cancelled, appointment_count
             FROM v_branch_appointments
             WHERE branch_id = ?
               AND date > (SELECT MAX(date) FROM v_branch_appointments WHERE branch_id = ?)
                          - INTERVAL 30 DAY
             ORDER BY date`;
      params = [branchId, branchId];
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching branch appointments:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/reports/branch-summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT REPLACE(branch, 'MedSync ', '') AS branch,
             SUM(completed) AS completed,
             SUM(scheduled) AS scheduled,
             SUM(cancelled) AS cancelled
      FROM v_branch_appointments
      GROUP BY branch
      ORDER BY branch`);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching branch summary:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/branches', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT branch_id, name FROM BRANCH ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error('Error fetching branches:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/reports/branch-appointments/months', async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({ success: false, error: 'branchId is required' });
    }
    const [rows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') AS month
       FROM v_branch_appointments
       WHERE branch_id = ?
       ORDER BY month DESC`,
      [branchId]
    );
    res.json(rows.map((r) => r.month));
  } catch (e) {
    console.error('Error fetching months:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});


// Express Route: POST /api/patient/register
app.post('/api/patient/register', async (req, res) => {
  const { nic, email, password } = req.body;

  try {
    // 1. Verify that the NIC exists in the PATIENT table
    const [patients] = await pool.query('SELECT patient_id FROM PATIENT WHERE nic = ?', [nic]);
    
    if (patients.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'NIC not found in hospital records. Please contact the clinic desk.' 
      });
    }

    const patientId = patients[0].patient_id;

    // 2. Check if an account already exists for this patient or email
    const [existing] = await pool.query(
      'SELECT auth_id FROM PATIENT_AUTH WHERE patient_id = ? OR email = ?',
      [patientId, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'An account is already registered for this NIC or Email.' 
      });
    }

    // 3. Hash the password and insert into PATIENT_AUTH
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO PATIENT_AUTH (patient_id, email, password_hash) VALUES (?, ?, ?)',
      [patientId, email, hashedPassword]
    );

    res.json({ success: true, message: 'Account successfully registered!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete registration.' });
  }
});

const bcrypt = require('bcryptjs');

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. ADMIN LOGIN CHECK
    if (email === 'admins@medsync.lk') {
      if (password === 'admin123') {
        return res.json({
          success: true,
          role: 'ADMIN',
          user: {
            name: 'User',
            email: 'admins@medsync.lk',
          },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      }
    }

    // 2. PATIENT LOGIN CHECK (Using v_patient_login_info view)
    const [rows] = await pool.query(
      `SELECT patient_id, nic, first_name, last_name, phone, email, password_hash 
       FROM v_patient_login_info 
       WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const patient = rows[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, patient.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Return patient details with role 'PATIENT'
    const { password_hash, ...patientProfile } = patient;
    res.json({
      success: true,
      role: 'PATIENT',
      user: patientProfile,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});