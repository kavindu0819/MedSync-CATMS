require('dotenv').config();
const express = require('express');
const pool = require('./docker_connect'); // Imports your database connection pool
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
// Opaque, short-lived sessions for every signed-in user. Each login gets a
// random token; the browser sends it back as "Authorization: Bearer <token>"
// and the server looks up who it belongs to. Kept in memory, so restarting
// the backend signs everyone out.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map(); // token -> { role, patientId?, staffId?, expires }
const sessionCleanup = setInterval(() => {
  for (const [token, session] of sessions) if (session.expires <= Date.now()) sessions.delete(token);
}, 60000);
sessionCleanup.unref();

function createSession(details) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { ...details, expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function readSession(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const session = sessions.get(token);
  return session && session.expires > Date.now() ? session : null;
}

function requirePatient(req, res, next) {
  const session = readSession(req);
  if (!session || session.role !== 'PATIENT') return res.status(401).json({success:false,message:'Please sign in again to manage appointments.'});
  req.patientId = session.patientId;
  next();
}

// Allows the request only for the listed roles, e.g. requireRole('ADMIN').
// 401 = not signed in (or session expired); 403 = signed in, wrong role.
function requireRole(...roles) {
  return (req, res, next) => {
    const session = readSession(req);
    if (!session) return res.status(401).json({ success: false, message: 'Please sign in again.' });
    if (!roles.includes(session.role)) return res.status(403).json({ success: false, message: 'You do not have access to this.' });
    req.session = session;
    next();
  };
}

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
// Admin and front desk only. Sri Lankan NIC formats: old (9 digits + V/X)
// or new (12 digits).
const NIC_PATTERN = /^(\d{9}[VvXx]|\d{12})$/;
const PHONE_PATTERN = /^0\d{9}$/;
const GENDERS = ['Male', 'Female', 'Other'];

app.post('/api/patients', requireRole('ADMIN', 'FRONTDESK'), async (req, res) => {
  try {
    const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const nic = clean(req.body.nic)?.toUpperCase() ?? null;
    const guardian_nic = clean(req.body.guardian_nic)?.toUpperCase() ?? null;
    const first_name = clean(req.body.first_name);
    const last_name = clean(req.body.last_name);
    const dob = clean(req.body.dob);
    const gender = clean(req.body.gender);
    const address = clean(req.body.address);
    const phone = clean(req.body.phone);

    if (!nic || !first_name || !last_name || !dob || !gender) {
      return res.status(400).json({
        success: false,
        message: 'NIC, first name, last name, date of birth and gender are required.'
      });
    }
    if (!NIC_PATTERN.test(nic)) {
      return res.status(400).json({ success: false, message: 'NIC must be 9 digits followed by V or X, or 12 digits.' });
    }
    if (guardian_nic && !NIC_PATTERN.test(guardian_nic)) {
      return res.status(400).json({ success: false, message: 'Guardian NIC must be 9 digits followed by V or X, or 12 digits.' });
    }
    if (!GENDERS.includes(gender)) {
      return res.status(400).json({ success: false, message: 'Gender must be Male, Female or Other.' });
    }
    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00`) : null;
    if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      return res.status(400).json({ success: false, message: 'Date of birth must be a real date that is not in the future.' });
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone must be 10 digits starting with 0, e.g. 0771234567.' });
    }

    // Insert record using a parameterized SQL query
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

    // Respond with the auto-generated ID
    res.status(201).json({
      success: true,
      message: 'Patient registered successfully!',
      patientId: result.insertId
    });

  } catch (error) {
    // uq_patient_nic in 02_constraints.sql: one patient per NIC
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A patient with this NIC is already registered.' });
    }
    console.error('Error creating patient:', error.message);
    res.status(500).json({ success: false, message: 'Could not add the patient. Please try again.' });
  }
});
// ----------------------------------------------------
// 2. DOCTOR ENDPOINTS
// ----------------------------------------------------

// GET all doctors (optionally filtered by branch)
app.get('/api/doctors', async (req, res) => {
  try {
    const { branchId } = req.query;
    const params = [];
    let where = '';

    if (branchId !== undefined && branchId !== '') {
      if (!/^[1-9]\d*$/.test(String(branchId))) {
        return res.status(400).json({ success: false, message: 'branchId must be a positive integer.' });
      }
      where = 'WHERE d.branch_id = ?';
      params.push(Number(branchId));
    }

    const [rows] = await pool.query(`
      SELECT
        d.doctor_id,
        d.branch_id,
        d.registration_no,
        CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
        b.name AS branch_name,
        COALESCE(GROUP_CONCAT(DISTINCT sp.specialty_name ORDER BY sp.specialty_name SEPARATOR ', '), 'General medicine') AS specialties
      FROM DOCTOR d
      JOIN STAFF s ON s.staff_id = d.doctor_id
      JOIN BRANCH b ON b.branch_id = d.branch_id
      LEFT JOIN DOCTOR_SPECIALTY ds ON ds.doctor_id = d.doctor_id
      LEFT JOIN SPECIALTY sp ON sp.specialty_id = ds.specialty_id
      ${where}
      GROUP BY d.doctor_id, d.branch_id, d.registration_no, s.first_name, s.last_name, b.name
      ORDER BY b.name, s.first_name, s.last_name;
    `, params);

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

// GET /api/doctor/appointments?scope=today|upcoming|past
// Only the signed-in doctor's own appointments: the doctor comes from the
// session (staff_id = doctor_id), never from the URL, so one doctor cannot
// read another doctor's list. upcoming/past are capped at 100 rows.
const DOCTOR_SCOPES = {
  today:    { where: 'a.appointment_date = ?', order: 'a.scheduled_start ASC' },
  upcoming: { where: 'a.appointment_date >= ?', order: 'a.appointment_date ASC, a.scheduled_start ASC' },
  past:     { where: 'a.appointment_date < ?', order: 'a.appointment_date DESC, a.scheduled_start DESC' },
};

app.get('/api/doctor/appointments', requireRole('DOCTOR'), async (req, res) => {
  try {
    const scope = req.query.scope || 'upcoming';
    const rule = DOCTOR_SCOPES[scope];
    if (!rule) {
      return res.status(400).json({ success: false, message: 'scope must be today, upcoming or past' });
    }

    // Today's date on this machine (Sri Lanka time), not the database's UTC clock.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [rows] = await pool.query(
      `SELECT a.appointment_id,
              a.appointment_date AS date,
              TIME_FORMAT(a.scheduled_start, '%H:%i') AS start,
              TIME_FORMAT(a.scheduled_end, '%H:%i')   AS end,
              a.status,
              a.is_walkin,
              p.patient_id,
              CONCAT(p.first_name, ' ', p.last_name) AS patient,
              b.name AS branch
       FROM APPOINTMENT a
       JOIN PATIENT p ON p.patient_id = a.patient_id
       JOIN BRANCH b  ON b.branch_id  = a.branch_id
       WHERE a.doctor_id = ? AND ${rule.where}
       ORDER BY ${rule.order}
       LIMIT 100`,
      [req.session.staffId, today]
    );

    res.json({ success: true, scope, today, appointments: rows });
  } catch (error) {
    console.error('Error fetching doctor appointments:', error.message);
    res.status(500).json({ success: false, message: 'Could not load your appointments.' });
  }
});

// PATCH /api/doctor/appointments/:id/complete
// The signed-in doctor marks one of their own appointments Completed. All the
// rules are in the WHERE clause, so it changes nothing unless the appointment
// is theirs, still Scheduled, and has already started (Sri Lanka time).
// trg_appointment_audit (05_triggers.sql) records the change automatically.
app.patch('/api/doctor/appointments/:id/complete', requireRole('DOCTOR'), async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const [result] = await pool.query(
      `UPDATE APPOINTMENT SET status = 'Completed'
       WHERE appointment_id = ? AND doctor_id = ? AND status = 'Scheduled'
         AND TIMESTAMP(appointment_date, scheduled_start) <= ?`,
      [req.params.id, req.session.staffId, localNow]
    );

    if (!result.affectedRows) {
      return res.status(409).json({
        success: false,
        message: 'This appointment cannot be completed. It may not have started yet, already be completed or cancelled, or belong to another doctor.',
      });
    }
    res.json({ success: true, message: 'Appointment marked as completed.' });
  } catch (error) {
    console.error('Error completing appointment:', error.message);
    res.status(500).json({ success: false, message: 'Could not update the appointment. Please try again.' });
  }
});

// Appointment availability for patient self-service booking.
// Patients may choose ANY branch. Doctors are filtered to the selected branch.
app.get('/api/appointments/availability', async (req, res) => {
  try {
    const { branchId, doctorId, date } = req.query;

    if (!/^[1-9]\d*$/.test(String(branchId || '')) || !/^[1-9]\d*$/.test(String(doctorId || ''))) {
      return res.status(400).json({ success: false, message: 'branchId and doctorId are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
      return res.status(400).json({ success: false, message: 'date must be in YYYY-MM-DD format.' });
    }

    const [[doctor]] = await pool.query(
      `SELECT d.doctor_id, d.branch_id, CONCAT(s.first_name, ' ', s.last_name) AS doctor_name
       FROM DOCTOR d
       JOIN STAFF s ON s.staff_id = d.doctor_id
       WHERE d.doctor_id = ?`,
      [Number(doctorId)]
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }
    if (Number(doctor.branch_id) !== Number(branchId)) {
      return res.status(400).json({ success: false, message: 'Selected doctor does not belong to the selected branch.' });
    }

    const [[clock]] = await pool.query('SELECT CURDATE() AS today, CURTIME() AS now_time');
    if (String(date) < String(clock.today).slice(0, 10)) {
      return res.status(400).json({ success: false, message: 'Appointments cannot be booked in the past.' });
    }

    const [busyRows] = await pool.query(
      `SELECT scheduled_start, scheduled_end
       FROM APPOINTMENT
       WHERE doctor_id = ?
         AND appointment_date = ?
         AND status <> 'Cancelled'
       ORDER BY scheduled_start`,
      [Number(doctorId), date]
    );

    const toMinutes = (time) => {
      const [h, m] = String(time).split(':').map(Number);
      return h * 60 + m;
    };
    const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

    const busy = busyRows.map((row) => ({
      start: toMinutes(row.scheduled_start),
      end: toMinutes(row.scheduled_end),
    }));

    const today = String(clock.today).slice(0, 10);
    const nowMinutes = toMinutes(clock.now_time);
    const slots = [];
    const slotMinutes = 30;
    const opening = 9 * 60;
    const closing = 17 * 60;

    for (let start = opening; start + slotMinutes <= closing; start += slotMinutes) {
      const end = start + slotMinutes;
      const clashes = busy.some((range) => start < range.end && end > range.start);
      const alreadyPassed = String(date) === today && start <= nowMinutes;
      if (!clashes && !alreadyPassed) {
        slots.push({ start: toTime(start), end: toTime(end) });
      }
    }

    res.json({
      success: true,
      branchId: Number(branchId),
      doctorId: Number(doctorId),
      doctorName: doctor.doctor_name,
      date,
      slotMinutes,
      data: slots,
    });
  } catch (error) {
    console.error('Error fetching appointment availability:', error.message);
    res.status(500).json({ success: false, message: 'Unable to load appointment availability.' });
  }
});

// POST /api/appointments - Create a new appointment.
// The patient is deliberately not tied to a branch: branch_id belongs to
// the appointment, so the same patient may visit different branches.
app.post('/api/appointments', async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      branch_id,
      room_id = null,
      appointment_date,
      scheduled_start,
      scheduled_end = null,
      status = 'Scheduled',
      is_walkin = false,
    } = req.body;

    const patientId = Number(patient_id);
    const doctorId = Number(doctor_id);
    const branchId = Number(branch_id);
    const roomId = room_id === null || room_id === '' ? null : Number(room_id);

    if (![patientId, doctorId, branchId].every(Number.isInteger) || patientId <= 0 || doctorId <= 0 || branchId <= 0) {
      return res.status(400).json({ success: false, message: 'Valid patient, doctor and branch are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointment_date || ''))) {
      return res.status(400).json({ success: false, message: 'appointment_date must be in YYYY-MM-DD format.' });
    }
    if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(String(scheduled_start || ''))) {
      return res.status(400).json({ success: false, message: 'scheduled_start must be a valid time.' });
    }

    const toMinutes = (time) => {
      const [h, m] = String(time).split(':').map(Number);
      if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
      return h * 60 + m;
    };
    const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

    const startMinutes = toMinutes(scheduled_start);
    let endMinutes = scheduled_end ? toMinutes(scheduled_end) : startMinutes + 30;
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return res.status(400).json({ success: false, message: 'Appointment end time must be after the start time.' });
    }
    if (startMinutes < 9 * 60 || endMinutes > 17 * 60) {
      return res.status(400).json({ success: false, message: 'Appointments must be within clinic hours (09:00-17:00).' });
    }

    const [[dateCheck]] = await pool.query('SELECT (? >= CURDATE()) AS valid_date', [appointment_date]);
    if (!dateCheck.valid_date) {
      return res.status(400).json({ success: false, message: 'Appointments cannot be booked in the past.' });
    }

    const [[patient]] = await pool.query('SELECT patient_id FROM PATIENT WHERE patient_id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const [[branch]] = await pool.query('SELECT branch_id, name FROM BRANCH WHERE branch_id = ?', [branchId]);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    const [[doctor]] = await pool.query(
      `SELECT d.doctor_id, d.branch_id, CONCAT(s.first_name, ' ', s.last_name) AS doctor_name
       FROM DOCTOR d
       JOIN STAFF s ON s.staff_id = d.doctor_id
       WHERE d.doctor_id = ?`,
      [doctorId]
    );
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }
    if (Number(doctor.branch_id) !== branchId) {
      return res.status(400).json({ success: false, message: 'Selected doctor does not belong to the selected branch.' });
    }

    if (roomId !== null) {
      if (!Number.isInteger(roomId) || roomId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid room.' });
      }
      const [[room]] = await pool.query('SELECT room_id, branch_id FROM ROOM WHERE room_id = ?', [roomId]);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
      }
      if (Number(room.branch_id) !== branchId) {
        return res.status(400).json({ success: false, message: 'Selected room does not belong to the selected branch.' });
      }
    }

    const startTime = toTime(startMinutes);
    const endTime = toTime(endMinutes);
    const [[clash]] = await pool.query(
      `SELECT COUNT(*) AS clash_count
       FROM APPOINTMENT
       WHERE doctor_id = ?
         AND appointment_date = ?
         AND status <> 'Cancelled'
         AND ? < scheduled_end
         AND ? > scheduled_start`,
      [doctorId, appointment_date, startTime, endTime]
    );
    if (Number(clash.clash_count) > 0) {
      return res.status(409).json({ success: false, message: 'That time slot was just taken. Please choose another available slot.' });
    }

    const [result] = await pool.query(
      `INSERT INTO APPOINTMENT
        (patient_id, doctor_id, branch_id, room_id, appointment_date, scheduled_start, scheduled_end, status, is_walkin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, doctorId, branchId, roomId, appointment_date, startTime, endTime, status, Boolean(is_walkin)]
    );

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      appointmentId: result.insertId,
      appointment: {
        patient_id: patientId,
        doctor_id: doctorId,
        doctor_name: doctor.doctor_name,
        branch_id: branchId,
        branch_name: branch.name,
        appointment_date,
        scheduled_start: startTime,
        scheduled_end: endTime,
        status,
      },
    });
  } catch (error) {
    console.error('Error booking appointment:', error.message);
    if (error?.errno === 1644 || error?.sqlState === '45000') {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Unable to book the appointment.' });
  }
});

app.get('/api/reports/summary', requireRole('ADMIN', 'FRONTDESK'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM v_dashboard_summary');
    res.json(rows[0]);                    // single object, not an array
  } catch (e) {
    console.error('Error fetching dashboard summary:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

app.get('/api/reports/branch-appointments', requireRole('ADMIN'), async (req, res) => {
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

app.get('/api/reports/branch-summary', requireRole('ADMIN', 'FRONTDESK'), async (req, res) => {
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

app.get('/api/reports/branch-appointments/months', requireRole('ADMIN'), async (req, res) => {
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
  const normalizedNic = typeof nic === 'string' ? nic.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedNic || !normalizedEmail || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'NIC, a valid email, and a password of at least 6 characters are required.'
    });
  }

  try {
    // 1. Verify that the NIC exists in the PATIENT table
    const [patients] = await pool.query('SELECT patient_id FROM PATIENT WHERE nic = ?', [normalizedNic]);
    
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
      [patientId, normalizedEmail]
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
      [patientId, normalizedEmail, hashedPassword]
    );

    res.json({ success: true, message: 'Account successfully registered!' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. ADMIN LOGIN CHECK
    // Standard system admin accounts
    if (
      normalizedEmail === 'admins@medsync.lk' ||
      normalizedEmail === 'admin@medsync.lk' ||
      normalizedEmail === 'admin@medsync.com'
    ) {
      if (password === 'admin123') {
        return res.json({
          success: true,
          role: 'ADMIN',
          token: createSession({ role: 'ADMIN' }),
          user: {
            name: 'System Administrator',
            email: normalizedEmail,
            role: 'Admin',
          },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      }
    }

    // Check if the email belongs to any STAFF member (Branch Managers, etc.)
    const [staffRows] = await pool.query(
      `SELECT staff_id, branch_id, first_name, last_name, role, email 
       FROM STAFF 
       WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    if (staffRows.length > 0) {
      if (password === 'admin123' || password === 'staff123') {
        const staff = staffRows[0];
        // Receptionists run the front desk: they may add patients and view the
        // Overview, nothing else. Doctors get their own DOCTOR role (staff_id is
        // also their doctor_id, see DOCTOR in 01_schema.sql). Every other staff
        // role keeps admin access.
        const role = staff.role === 'Receptionist' ? 'FRONTDESK'
          : staff.role === 'Doctor' ? 'DOCTOR'
          : 'ADMIN';
        return res.json({
          success: true,
          role,
          token: createSession({ role, staffId: staff.staff_id }),
          user: {
            staff_id: staff.staff_id,
            name: `${staff.first_name} ${staff.last_name}`,
            email: staff.email,
            role: staff.role,
            branch_id: staff.branch_id,
          },
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials for staff account.' });
      }
    }

    // 2. PATIENT LOGIN CHECK (Using v_patient_login_info view)
    const [rows] = await pool.query(
      `SELECT patient_id, nic, first_name, last_name, phone, email, password_hash 
       FROM v_patient_login_info 
       WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'No registered patient or administrator found with this email.' });
    }

    const patient = rows[0];

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, patient.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please check and try again.' });
    }

    // Return patient details with role 'PATIENT'
    const { password_hash, ...patientProfile } = patient;
    const token = createSession({ role: 'PATIENT', patientId: patient.patient_id });
    res.json({
      success: true,
      role: 'PATIENT',
      token,
      user: patientProfile,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ----------------------------------------------------
// 5. PATIENT DASHBOARD ENDPOINT
// ----------------------------------------------------

// Ownership and eligibility are checked in the same atomic UPDATE.
app.patch('/api/patient/appointments/:id/cancel', requirePatient, async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({success:false,message:'Invalid appointment ID.'});
  try {
    const [result] = await pool.query(
      `UPDATE APPOINTMENT SET status = 'Cancelled'
       WHERE appointment_id = ? AND patient_id = ? AND status = 'Scheduled'
         AND TIMESTAMP(appointment_date, scheduled_start) > NOW()`,
      [req.params.id, req.patientId]);
    if (!result.affectedRows) return res.status(409).json({success:false,message:'This appointment cannot be cancelled. It may have started, changed status, or belong to another patient. Refresh your appointments.'});
    res.json({success:true,message:'Appointment cancelled.'});
  } catch (error) {
    console.error('Cancellation failed:', error.message);
    res.status(500).json({success:false,message:'Unable to cancel the appointment. Please try again.'});
  }
});

app.get('/api/patients/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid patient ID.' });
    }

    // 1. Patient profile
    const [patientRows] = await pool.query(
      `SELECT p.patient_id, p.nic, p.first_name, p.last_name, p.dob, p.gender,
              p.phone, p.address, pa.email
       FROM PATIENT p
       LEFT JOIN PATIENT_AUTH pa ON pa.patient_id = p.patient_id
       WHERE p.patient_id = ?`,
      [id]
    );

    if (patientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const patient = patientRows[0];
    const fullName = `${patient.first_name} ${patient.last_name}`.trim();

    // 2. Upcoming appointments for this patient
    const [apptRows] = await pool.query(`
      SELECT 
        a.appointment_id,
        a.appointment_date,
        a.scheduled_start,
        a.scheduled_end,
        a.status,
        a.is_walkin,
        (a.status = 'Scheduled' AND TIMESTAMP(a.appointment_date, a.scheduled_start) > NOW()) AS is_upcoming,
        b.name AS branch_name,
        CONCAT(s.first_name, ' ', s.last_name) AS doctor_name,
        COALESCE(
          (SELECT sp.specialty_name 
           FROM DOCTOR_SPECIALTY ds 
           JOIN SPECIALTY sp ON ds.specialty_id = sp.specialty_id 
           WHERE ds.doctor_id = a.doctor_id 
           LIMIT 1),
          'General medicine'
        ) AS specialty
      FROM APPOINTMENT a
      JOIN BRANCH b ON a.branch_id = b.branch_id
      JOIN DOCTOR d ON a.doctor_id = d.doctor_id
      JOIN STAFF s ON d.doctor_id = s.staff_id
      WHERE a.patient_id = ?
      ORDER BY is_upcoming DESC,
        CASE WHEN is_upcoming THEN TIMESTAMP(a.appointment_date,a.scheduled_start) END ASC,
        a.appointment_date DESC, a.scheduled_start DESC;
    `, [id]);

    const [[visitSummary]] = await pool.query(
      `SELECT COUNT(*) AS total_visits
       FROM APPOINTMENT
       WHERE patient_id = ? AND status = 'Completed'`,
      [id]
    );
    const [[upcomingSummary]] = await pool.query(
      `SELECT COUNT(*) AS upcoming_count
       FROM APPOINTMENT
       WHERE patient_id = ? AND status = 'Scheduled' AND TIMESTAMP(appointment_date, scheduled_start) > NOW()`,
      [id]
    );
    const nextAppt = apptRows
      .filter((appointment) => appointment.is_upcoming)
      .sort((a, b) =>
        String(a.appointment_date).localeCompare(String(b.appointment_date)) ||
        String(a.scheduled_start).localeCompare(String(b.scheduled_start))
      )[0];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const formattedAppts = apptRows.map((a) => {
      const [year, monthNumber, dayNumber] = String(a.appointment_date).slice(0, 10).split('-').map(Number);
      const day = String(dayNumber).padStart(2, '0');
      const month = monthNames[monthNumber - 1]?.toUpperCase() || '';

      let timeStr = a.scheduled_start || '09:30';
      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        const hourNum = parseInt(h, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const formattedHour = hourNum % 12 || 12;
        timeStr = `${formattedHour}:${m} ${ampm}`;
      }

      return {
        id: a.appointment_id,
        canCancel: Boolean(a.is_upcoming),
        start: String(a.scheduled_start).slice(0,5),
        end: String(a.scheduled_end).slice(0,5),
        walkIn: Boolean(a.is_walkin),
        day,
        month,
        year,
        date: String(a.appointment_date).slice(0, 10),
        doctor: `Dr. ${a.doctor_name}`,
        dept: a.specialty,
        branch: a.branch_name,
        time: timeStr,
        status: a.status,
      };
    });

    // 3. Consultation history for this patient
    const [recordRows] = await pool.query(`
      SELECT
        c.consultation_id,
        c.diagnosis,
        c.notes,
        a.appointment_date,
        a.status,
        CONCAT(s.first_name, ' ', s.last_name) AS doctor_name
      FROM CONSULTATION c
      JOIN APPOINTMENT a ON a.appointment_id = c.appointment_id
      JOIN DOCTOR d ON d.doctor_id = a.doctor_id
      JOIN STAFF s ON s.staff_id = d.doctor_id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.scheduled_start DESC
      LIMIT 20;
    `, [id]);
    const formattedRecords = recordRows.map((record) => ({
      id: record.consultation_id,
      date: String(record.appointment_date).slice(0, 10),
      diagnosis: record.diagnosis || 'Diagnosis not recorded',
      notes: record.notes || 'No notes recorded',
      doctor: `Dr. ${record.doctor_name}`,
      status: record.status,
    }));

    // 4. Billing & invoices
    const [invoiceRows] = await pool.query(`
      SELECT 
        i.invoice_id,
        i.total_amount,
        i.paid_amount,
        i.balance_due,
        a.appointment_date,
        COALESCE(GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', '), '') AS treatments
      FROM INVOICE i
      JOIN APPOINTMENT a ON i.appointment_id = a.appointment_id
      LEFT JOIN APPT_TREATMENT at ON at.appointment_id = a.appointment_id
      LEFT JOIN TREATMENT t ON t.treatment_id = at.treatment_id
      WHERE a.patient_id = ?
      GROUP BY i.invoice_id, i.total_amount, i.paid_amount, i.balance_due, a.appointment_date
      ORDER BY a.appointment_date DESC;
    `, [id]);

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const formattedBills = invoiceRows.map((inv) => {
      const total = Number(inv.total_amount) || 0;
      const paid = Number(inv.paid_amount) || 0;
      const due = Number(inv.balance_due) || 0;
      totalBilled += total;
      totalPaid += paid;
      totalOutstanding += due;

      return {
        id: inv.invoice_id,
        date: inv.appointment_date,
        treatment: inv.treatments || 'No treatment details recorded',
        amount: total,
        status: due <= 0 ? 'Paid' : paid > 0 ? 'Partly paid' : 'Unpaid',
      };
    });

    // 5. Insurance Policy
    const [policyRows] = await pool.query(`
      SELECT 
        ip.policy_id,
        ip.provider_name,
        ip.annual_ceiling,
        ip.valid_from,
        ip.valid_to,
        (ip.valid_from <= CURDATE() AND ip.valid_to >= CURDATE()) AS is_active,
        COALESCE(SUM(ic.approved_amount), 0) AS used_amount
      FROM INSURANCE_POLICY ip
      LEFT JOIN INSURANCE_CLAIM ic ON ic.policy_id = ip.policy_id
      WHERE ip.patient_id = ?
      GROUP BY ip.policy_id, ip.provider_name, ip.annual_ceiling, ip.valid_from, ip.valid_to
      ORDER BY (ip.valid_from <= CURDATE() AND ip.valid_to >= CURDATE()) DESC, ip.valid_to DESC
      LIMIT 1;
    `, [id]);

    let insuranceData = {
      provider: 'None',
      status: 'Inactive',
      renews: 'N/A',
      used: 0,
      limit: 0,
    };

    if (policyRows.length > 0) {
      const pol = policyRows[0];
      const ceiling = Number(pol.annual_ceiling) || 0;
      const usedAmount = Math.min(ceiling, Number(pol.used_amount) || 0);
      insuranceData = {
        provider: pol.provider_name,
        status: pol.is_active ? 'Active' : 'Inactive',
        renews: pol.valid_to,
        used: usedAmount,
        limit: ceiling,
      };
    }

    // 6. Completed visits during the current and previous five calendar months
    const [monthlyVisits] = await pool.query(`
      SELECT DATE_FORMAT(appointment_date, '%Y-%m') AS month_key, COUNT(*) AS visit_count
      FROM APPOINTMENT
      WHERE patient_id = ?
        AND status = 'Completed'
        AND appointment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY DATE_FORMAT(appointment_date, '%Y-%m')
    `, [id]);
    const monthCounts = new Map(monthlyVisits.map((row) => [row.month_key, Number(row.visit_count)]));
    const now = new Date();
    const visitsPerMonth = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return { month: monthNames[monthDate.getMonth()], count: monthCounts.get(monthKey) || 0 };
    });

    let nextApptDate = 'None';
    let nextApptDetail = 'No upcoming appointments scheduled';
    if (nextAppt) {
      const [, monthNumber, dayNumber] = String(nextAppt.appointment_date).slice(0, 10).split('-').map(Number);
      let time = String(nextAppt.scheduled_start || '09:30');
      if (time.includes(':')) {
        const [hour, minute] = time.split(':');
        const hourNumber = Number(hour);
        time = `${hourNumber % 12 || 12}:${minute} ${hourNumber >= 12 ? 'PM' : 'AM'}`;
      }
      nextApptDate = `${dayNumber} ${monthNames[monthNumber - 1]}`;
      nextApptDetail = `${time} · ${nextAppt.branch_name}`;
    }

    res.json({
      success: true,
      patient: {
        name: fullName,
        nic: patient.nic,
        phone: patient.phone,
        email: patient.email || '',
      },
      stats: {
        nextAppointment: {
          date: nextApptDate,
          detail: nextApptDetail,
        },
        upcomingCount: Number(upcomingSummary.upcoming_count),
        activePrescriptions: null,
        totalVisits: Number(visitSummary.total_visits),
      },
      billing: {
        billed: totalBilled,
        paid: totalPaid,
        outstanding: totalOutstanding,
      },
      appointments: formattedAppts,
      records: formattedRecords,
      visitsPerMonth,
      bills: formattedBills,
      insurance: insuranceData,
    });
  } catch (error) {
    console.error('Error fetching patient dashboard:', error.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// ----------------------------------------------------
// 6. ADDITIONAL REPORTS ENDPOINTS
// ----------------------------------------------------

// GET /api/reports/doctor-revenue
// v_doctor_revenue has one row per doctor per day. The report wants one row
// per doctor, so the filters narrow the days first (WHERE) and the remaining
// days are then added up per doctor (GROUP BY + SUM). No LIMIT: there is one
// row per doctor, so the result is always small.
app.get('/api/reports/doctor-revenue', requireRole('ADMIN'), async (req, res) => {
  try {
    const { doctor, from, to } = req.query;
    const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

    if ((from && !isDate(from)) || (to && !isDate(to))) {
      return res.status(400).json({ success: false, error: 'from and to must look like 2026-01-31' });
    }

    const conditions = [];
    const params = [];

    if (doctor) {
      conditions.push('doctor LIKE ?');
      params.push(`%${doctor}%`);
    }
    if (from) {
      conditions.push('date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('date <= ?');
      params.push(to);
    }

    const sql = `SELECT doctor,
                        branch,
                        SUM(consultations) AS consultations,
                        SUM(treatments)    AS treatments,
                        SUM(revenue)       AS revenue
                 FROM v_doctor_revenue
                 ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
                 GROUP BY doctor, branch
                 ORDER BY revenue DESC, doctor`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching doctor revenue:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// GET /api/reports/outstanding-balances
// Paginated: ?page=N returns 100 rows plus the totals the frontend needs to
// draw page buttons. invoice_id breaks ties so equal balances never appear
// on two pages (or on none).
app.get('/api/reports/outstanding-balances', requireRole('ADMIN'), async (req, res) => {
  try {
    const pageSize = 100;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM v_outstanding_balances'
    );

    const [rows] = await pool.query(
      `SELECT * FROM v_outstanding_balances
       ORDER BY outstanding DESC, invoice_id
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    res.json({ rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (e) {
    console.error('Error fetching outstanding balances:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// GET /api/reports/treatment-categories
app.get('/api/reports/treatment-categories', requireRole('ADMIN'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const isValidDate = (value) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };

    if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
      return res.status(400).json({
        success: false,
        error: 'from and to must be valid dates in YYYY-MM-DD format',
      });
    }
    if (from && to && from > to) {
      return res.status(400).json({
        success: false,
        error: 'from must be earlier than or equal to to',
      });
    }

    let sql = `
      SELECT
        tc.category_name AS category,
        COUNT(att.appt_treatment_id) AS treatment_count,
        COALESCE(SUM(att.price_snapshot), 0) AS treatment_value
      FROM APPT_TREATMENT att
      JOIN TREATMENT t ON t.treatment_id = att.treatment_id
      JOIN TREATMENT_CATEGORY tc ON tc.category_id = t.category_id
      JOIN APPOINTMENT a ON a.appointment_id = att.appointment_id
    `;
    const conditions = [];
    const params = [];

    if (from) {
      conditions.push('a.appointment_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('a.appointment_date <= ?');
      params.push(to);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += `
      GROUP BY tc.category_id, tc.category_name
      ORDER BY treatment_count DESC, tc.category_name;
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('Error fetching treatment categories:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// GET /api/reports/insurance-coverage
// Paginated like outstanding-balances: ?page=N returns 100 claims, newest
// first, plus the totals the frontend needs to draw page buttons.
// invoice_id is the sort key because each invoice currently has at most one
// claim; if resubmitted claims are ever allowed, add claim_id to the view
// and sort on that instead, or rows could repeat across pages.
app.get('/api/reports/insurance-coverage', requireRole('ADMIN'), async (req, res) => {
  try {
    const pageSize = 100;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * pageSize;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM v_insurance_coverage'
    );

    const [rows] = await pool.query(
      `SELECT * FROM v_insurance_coverage
       ORDER BY invoice_id DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    res.json({ rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (e) {
    console.error('Error fetching insurance coverage:', e.message);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// Start listening on port 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
