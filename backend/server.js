require('dotenv').config();
const express = require('express');
const pool = require('./docker_connect'); // Imports your database connection pool

const app = express();
const PORT = process.env.PORT || 5000;

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
    res.status(500).json({ success: false, error: 'Database query failed' });
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
    res.status(500).json({ success: false, error: 'Database query failed' });
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
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// Start listening on port 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});