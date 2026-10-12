require('dotenv').config();
const express = require('express');
const pool = require('./docker_connect'); // Imports your database connection pool
const bcrypt = require('bcryptjs');

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
        return res.json({
          success: true,
          role: 'ADMIN',
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

// ----------------------------------------------------
// 5. PATIENT DASHBOARD ENDPOINT
// ----------------------------------------------------
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
        (a.status = 'Scheduled' AND a.appointment_date >= CURDATE()) AS is_upcoming,
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
      ORDER BY a.appointment_date ASC, a.scheduled_start ASC
      LIMIT 15;
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
       WHERE patient_id = ? AND status = 'Scheduled' AND appointment_date >= CURDATE()`,
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
app.get('/api/reports/doctor-revenue', async (req, res) => {
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
app.get('/api/reports/outstanding-balances', async (req, res) => {
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
app.get('/api/reports/treatment-categories', async (req, res) => {
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
app.get('/api/reports/insurance-coverage', async (req, res) => {
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
