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
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/reports/branch-appointments', async (req, res) => {
  try {
    const { branch, date } = req.query;
    const where = [];
    const params = [];

    if (branch) { where.push('branch LIKE ?'); params.push(`%${branch}%`); }
    if (date)   { where.push('date = ?');      params.push(date); }

    const sql = `SELECT * FROM v_branch_appointments
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY date DESC, branch`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});