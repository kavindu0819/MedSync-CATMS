import { validateAppointment } from './appointment.js';
export const doctors = [
  { id: 'perera', name: 'Dr. N. Perera', specialty: 'General medicine', branch: 'Colombo', fee: 2500 },
  { id: 'fernando', name: 'Dr. A. Fernando', specialty: 'General medicine', branch: 'Kandy', fee: 2000 },
  { id: 'silva', name: 'Dr. S. Silva', specialty: 'General medicine', branch: 'Galle', fee: 2000 },
  { id: 'jay', name: 'Dr. R. Jayasinghe', specialty: 'Paediatrics', branch: 'Colombo', fee: 3000 },
  { id: 'sen', name: 'Dr. M. Senanayake', specialty: 'Dermatology', branch: 'Kandy', fee: 3000 },
  { id: 'dias', name: 'Dr. K. Dias', specialty: 'Paediatrics', branch: 'Galle', fee: 2500 },
];
export const slots = ['09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00'];
export const currency = value => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);
export function bookingErrors(values, bookings, today) {
  const errors = validateAppointment(values, today);
  const doctor = doctors.find(d => d.id === values.doctor);
  if (!doctor || doctor.branch !== values.branch) errors.doctor = 'Choose a doctor at this branch.';
  if (!slots.includes(values.time)) errors.time = 'Choose a time.';
  if (bookings.some(b => b.id !== values.id && b.status !== 'Cancelled' && b.doctor === values.doctor && b.date === values.date && b.time === values.time)) errors.time = 'This demo slot is already booked. Choose another time.';
  return errors;
}
export function clinicTransition(state, action) {
  if (action.type === 'book') {
    const errors = bookingErrors(action.values, state.bookings, action.today);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const doctor = doctors.find(d => d.id === action.values.doctor);
    const id = `DEMO-${String(state.nextId).padStart(4, '0')}`;
    return { nextId: state.nextId + 1, bookings: [...state.bookings, { ...action.values, id, fee: doctor.fee, paid: 0, payments: [], status: 'Scheduled' }] };
  }
  const booking = state.bookings.find(b => b.id === action.id);
  if (!booking) throw new Error('Appointment not found. It may have been cleared by a page reload.');
  let updated = { ...booking };
  if (action.type === 'cancel') {
    if (booking.paid > 0) throw new Error('This demo cannot refund a payment. Cancel before simulating payment.');
    updated.status = 'Cancelled';
  } else if (action.type === 'reschedule') {
    if (booking.status !== 'Scheduled') throw new Error('Only scheduled appointments can be changed.');
    updated = { ...booking, date: action.date, time: action.time };
    const errors = bookingErrors(updated, state.bookings, action.today);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  } else if (action.type === 'pay') {
    if (booking.status === 'Cancelled') throw new Error('Cancelled invoices cannot be paid.');
    const amount = Number(action.amount);
    if (!/^\d+(\.\d{1,2})?$/.test(String(action.amount)) || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) > Math.round((booking.fee - booking.paid) * 100)) throw new Error('Enter a positive amount up to the outstanding balance, with at most two decimals.');
    updated.paid = (Math.round(booking.paid * 100) + Math.round(amount * 100)) / 100;
    updated.payments = [...booking.payments, { amount, number: booking.payments.length + 1 }];
  } else throw new Error('Unknown action.');
  return { ...state, bookings: state.bookings.map(b => b.id === booking.id ? updated : b) };
}
