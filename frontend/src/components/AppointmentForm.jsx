import { useState } from 'react';
import { useClinic } from '../ClinicContext';
import { bookingErrors, doctors, slots, currency } from '../clinic';
import { branches, todayInColombo } from '../appointment';
export default function AppointmentForm({ compact = false }) {
  const clinic = useClinic();
  const [values, setValues] = useState({ name: '', email: '', phone: '', branch: '', doctor: '', date: '', time: '', ...clinic?.draft });
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('details');
  const [reference, setReference] = useState('');
  function change(event) {
    const { name, value } = event.target;
    setValues(v => ({ ...v, [name]: value, ...(name === 'branch' ? { doctor: '', time: '' } : {}) }));
    setErrors({});
  }
  function submit(event) {
    event.preventDefault();
    if (compact) { clinic?.setDraft(values); window.location.hash = '#/appointments'; return; }
    const found = bookingErrors(values, clinic?.bookings || []);
    setErrors(found);
    if (!Object.keys(found).length) setStep('review');
    else document.getElementsByName(Object.keys(found)[0])[0]?.focus();
  }
  function confirm() {
    try { const id = clinic.act({ type: 'book', values }); setReference(id); clinic.setDraft({}); setStep('done'); }
    catch (error) { setErrors({ form: error.message }); }
  }
  function field(name, label, type = 'text', options) {
    const props = { id: `booking-${name}`, name, value: values[name], onChange: change, required: true, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `error-${name}` : undefined };
    return <label className="clinic-field" key={name} htmlFor={props.id}>{label}{options ? <select {...props}><option value="">Select {label.toLowerCase()}</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select> : <input {...props} type={type} min={type === 'date' ? todayInColombo() : undefined} autoComplete={name === 'name' ? 'name' : name === 'phone' ? 'tel' : name === 'email' ? 'email' : undefined} />}{errors[name] && <span className="field-error" id={`error-${name}`}>{errors[name]}</span>}</label>;
  }
  const doctor = doctors.find(d => d.id === values.doctor);
  return <section className="appointment-card full-booking"><div className="appointment-card-heading"><h2>{compact ? 'Plan your visit' : 'Book an appointment'}</h2></div><div className="clinic-form-body">
    <p className="demo-note">Demo only · Use fictional details. Data clears when you reload.</p>
    {step === 'details' && <form noValidate onSubmit={submit}>
      {!compact && <>{field('name', 'Full name')}{field('email', 'Email', 'email')}{field('phone', 'Phone', 'tel')}</>}
      {field('branch', 'Branch', 'text', branches.map(b => [b, b]))}
      {field('doctor', 'Doctor', 'text', doctors.filter(d => !values.branch || d.branch === values.branch).map(d => [d.id, `${d.name} · ${d.specialty}`]))}
      {field('date', 'Date', 'date')}
      {!compact && field('time', 'Time (Sri Lanka)', 'text', slots.map(s => [s, s]))}
      {doctor && <p>Demo consultation fee: <strong>{currency(doctor.fee)}</strong></p>}
      <button className="button button-blue" type="submit">{compact ? 'Continue to booking →' : 'Review appointment →'}</button>
    </form>}
    {step === 'review' && <div><h3>Review your appointment</h3><p>{values.name}<br />{values.email}<br />{values.phone}</p><p>{doctor?.name}<br />{values.branch} · {values.date} · {values.time}<br />{currency(doctor?.fee || 0)}</p><p>This creates a demo appointment and invoice in this browser session. No clinic is contacted.</p><div className="clinic-actions"><button className="button button-blue" onClick={confirm}>Confirm demo booking</button><button className="button button-outline" onClick={() => setStep('details')}>Edit details</button></div></div>}
    {step === 'done' && <div role="status"><h3>Demo appointment created</h3><p>Your reference: <strong>{reference}</strong></p><div className="clinic-actions"><a className="button button-blue" href="#/my-appointments">Manage appointments</a><a className="text-link" href="#/billing">View demo invoice →</a></div></div>}
    {errors.form && <p role="alert" className="field-error">{errors.form}</p>}
  </div></section>;
}
