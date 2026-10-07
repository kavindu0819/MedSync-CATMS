import { useEffect, useRef, useState } from "react";
import { DoctorsPage, MyAppointmentsPage, BillingPage } from "./ClinicPages";
import AppointmentForm from "./components/AppointmentForm";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import doctorPhoto from "./assets/doctor-hero.png";

const services = [
  { number: "01", icon: "heart", name: "Doctor consultations", description: "Start with a conversation. Plan a clinic visit for your routine or follow-up consultation." },
  { number: "02", icon: "medical", name: "Treatments & diagnostics", description: "Find a clear path from consultation to treatment, with your visit details kept together." },
  { number: "03", icon: "receipt", name: "Billing & insurance", description: "Keep track of invoices, payments, and insurance coverage in one connected system." },
];

// Each component below is a separate page. Only the selected page is rendered.
function HomePage() { return <>
      <section className="hero" id="home" aria-labelledby="hero-title">
        <img className="hero-photo" src={doctorPhoto} alt="" fetchPriority="high" />
        <div className="hero-shade" aria-hidden="true" />
        <span className="hero-shape" aria-hidden="true"><i /><i /></span>
        <span className="hero-cross" aria-hidden="true">+</span>
        <div className="hero-copy">
          <span className="section-kicker"><span className="blue-dot" /> HEALTHCARE, MADE SIMPLE</span>
          <h1 id="hero-title">We care for<br /><span>your health.</span></h1>
          <p>A little less waiting.<br />A little more care.</p>
          <p className="hero-description">Your next clinic visit starts here. Choose a branch, plan your appointment, and take the next step with MedSync.</p>
          <a href="#/appointments" className="button button-blue hero-cta">Book an appointment <Icon name="arrow" size={20} /></a>
          <a className="discover-link" href="#/services">Discover our services <span>↗</span></a>
          <div className="hero-caption"><span className="caption-icon"><Icon name="pin" size={20} /></span><div><strong>Closer to you</strong><span>Colombo · Kandy · Galle</span></div></div>
        </div>
        <AppointmentForm compact />
        <span className="hero-image-caption">A simpler way to connect with care.</span>
      </section>

      <div className="care-strip" aria-label="Appointment steps">
        <div><span className="strip-icon"><Icon name="pin" size={22} /></span><span><strong>Choose your branch</strong><small>Care, a little closer to home</small></span><b>01</b></div>
        <div><span className="strip-icon"><Icon name="calendar" size={22} /></span><span><strong>Plan your visit</strong><small>A date that works for you</small></span><b>02</b></div>
        <div><span className="strip-icon"><Icon name="heart" size={22} /></span><span><strong>Take the next step</strong><small>Your wellbeing comes first</small></span><b>03</b></div>
      </div>

</>; }
function ServicesPage() { return <><PageIntro title="Our services" description="Explore the care and support available through MedSync." />
      <section className="services-section content-section" id="services" aria-labelledby="services-title">
        <div className="section-heading"><div><span className="section-kicker">HERE FOR YOUR EVERYDAY CARE</span><h2 id="services-title">Care that fits your life.</h2></div><p>From your first appointment to your follow-up,<br className="desktop-break" /> every step belongs together.</p></div>
        <div className="service-grid">{services.map((service) => <article className="service-card" key={service.number}>
          <div className="service-top"><span className="service-icon"><Icon name={service.icon} size={28} /></span><span>{service.number}</span></div>
          <h3>{service.name}</h3><p>{service.description}</p>
          <a href={service.number === "03" ? "#/billing" : "#/appointments"}>{service.number === "03" ? "View billing" : "Plan an appointment"}<Icon name="arrow" size={18} /></a>
        </article>)}</div>
      </section>

</>; }
function AboutPage() { return <><PageIntro title="About MedSync" description="Connecting every step of your clinic experience." />
      <section className="about-section content-section" id="about" aria-labelledby="about-title">
        <div className="about-visual" aria-hidden="true"><span className="about-cross">+</span><Icon name="heart" size={96} /><p>A little more connected.<br /><strong>A little more cared for.</strong></p><span className="about-circle" /></div>
        <div className="about-copy"><span className="section-kicker">MEET MEDSYNC</span><h2 id="about-title">Better connected.<br />At every step.</h2><p>MedSync brings clinic appointments, treatments, billing, and reporting into one place. A clearer experience for patients. A simpler working day for clinic teams.</p>
          <ul><li><Icon name="check" size={18} /> One place to plan your clinic visit</li><li><Icon name="check" size={18} /> Clear appointment and billing information</li><li><Icon name="check" size={18} /> Five useful reports for your clinic team</li></ul>
          <a className="text-link" href="#/reports">Explore the reports dashboard <Icon name="arrow" size={18} /></a>
        </div>
      </section>

</>; }
function ContactPage() { return <><PageIntro title="Contact us" description="Start a conversation about your next clinic visit." />
      <section className="contact-section content-section" id="contact" aria-labelledby="contact-title"><div><span className="section-kicker">LET’S TAKE THE NEXT STEP</span><h2 id="contact-title">Your next visit starts<br />with a simple hello.</h2><p>Leave your contact details in the appointment form.</p><p className="contact-demo">This project is a demo. Clinic contact details and live bookings will be added when available.</p></div><a className="button button-white" href="#/appointments">Open appointment form <Icon name="arrow" /></a></section>

<section className="content-section contact-details"><span className="section-kicker">CLINIC INFORMATION</span><h2>Choose your next step</h2><p>Clinic phone numbers, email addresses and opening hours have not been provided yet. This is a student project demo.</p><a className="button button-blue" href="#/appointments">Open appointment form <Icon name="arrow" /></a></section>
</>; }
function AppointmentsPage() { return <><PageIntro title="Book an appointment" description="Choose your branch and preferred date for a demo consultation." /><section className="booking-page content-section"><div><span className="section-kicker">YOUR NEXT VISIT</span><h2>A little planning.<br />A little more peace of mind.</h2><p>Enter your contact details, choose an example branch and select your preferred date.</p><ul><li><Icon name="check" size={18} /> Review your details before taking the next step.</li><li><Icon name="calendar" size={18} /> Choose today or a future date.</li><li><Icon name="shield" size={18} /> Demo bookings stay in this tab until you reload.</li></ul><a className="text-link" href="#/services">Explore our services <Icon name="arrow" /></a></div><AppointmentForm /></section></>; }
function NotFoundPage() { return <><PageIntro title="Page not found" description="This address does not match a MedSync page." /><section className="content-section"><a className="button button-blue" href="#/home">Return to Home <Icon name="arrow" /></a></section></>; }
function PageIntro({ title, description }) { return <section className="page-intro"><nav aria-label="Breadcrumb"><a href="#/home">Home</a><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav><h1>{title}</h1><p>{description}</p></section>; }

export default function LandingPage({ page = "home", itemId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menuOpen]);
  const links = [["Home", "home"], ["Services", "services"], ["About us", "about"], ["Contact", "contact"], ["Reports", "reports"]];
  const pages = { doctors: DoctorsPage, "my-appointments": MyAppointmentsPage, billing: BillingPage, home: HomePage, services: ServicesPage, about: AboutPage, contact: ContactPage, appointments: AppointmentsPage };
  const CurrentPage = pages[page] || NotFoundPage;
  return <div className="site-frame">
    <button className="skip-link" onClick={() => document.getElementById("main-content")?.focus()}>Skip to content</button>
    <header className="site-header">
      <a className="brand-link" href="#/home" aria-label="MedSync home"><Logo /></a>
      <nav className={menuOpen ? "site-nav is-open" : "site-nav"} id="main-navigation" aria-label="Main navigation">
        {links.map(([label, route]) => <a key={route} href={`#/${route}`} className={page === route ? "active" : ""} aria-current={page === route ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <a className="mobile-appointment-link" href="#/appointments" aria-current={page === "appointments" ? "page" : undefined} onClick={() => setMenuOpen(false)}>Book an appointment</a>
      </nav>
      <a className="button button-blue header-book" href="#/appointments" aria-current={page === "appointments" ? "page" : undefined}><Icon name="calendar" size={17} /> Book an appointment</a>
      <button className="menu-toggle" ref={menuButton} aria-controls="main-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={24} /></button>
    </header>
    <nav className="clinic-nav" aria-label="Clinic workspace">{[["Find a doctor", "doctors"], ["Book a visit", "appointments"], ["My appointments", "my-appointments"], ["Billing", "billing"]].map(([label, target]) => <a key={target} href={`#/${target}`} aria-current={page === target ? "page" : undefined}>{label}</a>)}</nav>
    <div className="workspace-notice">DEMO WORKSPACE · Fictional doctors and fees · No real bookings or payments · Reloading clears your entries</div>
    <main id="main-content" tabIndex={-1} className={`route-content route-${page}`}><CurrentPage itemId={itemId} /></main>
    <footer className="site-footer"><a href="#/home" className="brand-link" aria-label="MedSync home"><Logo /></a><p>MedSync CATMS · Student project</p><a href="#/reports">Reports dashboard <Icon name="arrow" size={16} /></a></footer>
  </div>;
}
