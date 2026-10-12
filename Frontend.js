// src/components/AppointmentBooking.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { Calendar, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function AppointmentBooking() {
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    branch_id: '1',
    scheduled_start: '',
    scheduled_end: ''
  });

  const [status, setStatus] = useState({ type: null, message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await axios.post('http://localhost:8000/api/appointments', formData);
      setStatus({ type: 'success', message: `Booking successful! ID: ${response.data.appointment_id}` });
    } catch (err) {
      // Captures exact trigger/constraint error text from the backend
      const errorMsg = err.response?.data?.detail || 'Failed to book appointment. Please check inputs.';
      setStatus({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-blue-600" />
        Schedule Appointment
      </h2>

      {status.message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
          status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {status.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
          <div className="relative">
            <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="number" name="patient_id" required value={formData.patient_id} onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="e.g. 1001"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor ID</label>
            <input 
              type="number" name="doctor_id" required value={formData.doctor_id} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="e.g. 5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select 
              name="branch_id" value={formData.branch_id} onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="1">Colombo</option>
              <option value="2">Kandy</option>
              <option value="3">Galle</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input 
              type="datetime-local" name="scheduled_start" required value={formData.scheduled_start} onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input 
              type="datetime-local" name="scheduled_end" required value={formData.scheduled_end} onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>
        </div>

        <button 
          type="submit" disabled={loading}
          className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm Appointment'}
        </button>
      </form>
    </div>
  );
}