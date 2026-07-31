import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { appendFile } from "node:fs/promises";
import { useState } from "react";

// Handle contractor application submissions — append as newline-delimited JSON.
const submitContractorApplication = createServerFn({ method: "POST" })
  .handler(async (data: {
    name: string;
    companyName: string;
    email: string;
    phone: string;
    serviceType: string;
    yearsExperience: string;
    licenseNumber: string;
  }) => {
    const entry = {
      ...data,
      submittedAt: new Date().toISOString(),
    };
    await appendFile(
      "/home/team/shared/contractor-applications.json",
      JSON.stringify(entry) + "\n",
      "utf8"
    );
    return { success: true };
  });

export const Route = createFileRoute("/contractors")({
  component: Contractors,
});

const benefits = [
  {
    emoji: "📋",
    title: "Steady stream of jobs",
    description:
      "We connect you with homeowners actively looking for your services — so you spend less time hunting for work.",
  },
  {
    emoji: "💰",
    title: "Fair, transparent pay",
    description:
      "You set your own rates within platform guidelines, and you keep 80–85% of every completed job.",
  },
  {
    emoji: "📱",
    title: "We handle the admin",
    description:
      "Scheduling, payments, and customer communication run through the platform — you focus on the work.",
  },
  {
    emoji: "🕐",
    title: "Be your own boss",
    description:
      "Accept or decline jobs on your schedule. No shift requirements, no minimum hours.",
  },
];

const jobTypes = [
  {
    emoji: "🔧",
    title: "Repairs",
    description: "Plumbing, electrical, HVAC, and handyman services for residential properties.",
  },
  {
    emoji: "🧹",
    title: "Cleaning",
    description: "Standard, deep, and move-in/move-out cleaning for homes of all sizes.",
  },
  {
    emoji: "🌿",
    title: "Lawn Care",
    description: "Mowing, landscaping, seasonal cleanup, and fertilization treatments.",
  },
  {
    emoji: "🏠",
    title: "Maintenance",
    description: "Appliance service, HVAC tune-ups, seasonal inspections, and preventative upkeep.",
  },
  {
    emoji: "🏡",
    title: "Exterior Services",
    description: "Pressure washing, window cleaning, gutter cleaning, and deck restoration.",
  },
  {
    emoji: "🛡️",
    title: "Home Safety",
    description: "Safety inspections, smoke/CO detector installs, childproofing, and security consultations.",
  },
  {
    emoji: "📦",
    title: "Home Organization",
    description: "Closet, garage, and whole-home organization plus decluttering services.",
  },
  {
    emoji: "🐾",
    title: "Pet Services",
    description: "Dog walking, pet sitting, waste cleanup, and grooming.",
  },
];

const requirements = [
  "Valid Tennessee business license",
  "Liability insurance ($500k+)",
  "Background check",
  "2+ years professional experience",
  "Reliable transportation",
  "Own tools and equipment",
  "Smartphone for the ServiceHQ app",
];

const onboardingSteps = [
  { step: 1, title: "Submit application", description: "Fill out the form below with your details and service area." },
  { step: 2, title: "License & insurance verification", description: "We verify your credentials — typically 2–3 business days." },
  { step: 3, title: "Background check", description: "Standard background screening for the safety of our homeowners." },
  { step: 4, title: "Skills assessment / interview", description: "A brief phone or video call to review your experience and expertise." },
  { step: 5, title: "Platform orientation", description: "Walk through the ServiceHQ app, scheduling, and payment process." },
  { step: 6, title: "Start receiving jobs", description: "Your profile goes live and homeowners in your area can book you." },
];

const faqs = [
  {
    q: "How much does it cost to join?",
    a: "Joining ServiceHQ is completely free. There are no sign-up fees, monthly dues, or listing charges. We only earn when you earn — a 15–20% service fee per completed job.",
  },
  {
    q: "How quickly will I get jobs?",
    a: "Job volume varies by demand in your service area and your chosen categories. Some contractors receive their first booking within days; others may take a couple of weeks. We're actively marketing to homeowners across Tennessee.",
  },
  {
    q: "Can I set my own schedule?",
    a: "Absolutely. You choose which jobs to accept or decline. There are no minimum hours, no shift requirements — you're in full control of your calendar.",
  },
  {
    q: "What if there's a dispute with a homeowner?",
    a: "ServiceHQ provides mediation for any disputes. We review the job details, communicate with both parties, and work toward a fair resolution. Our goal is protecting both homeowners and contractors.",
  },
  {
    q: "Do I need my own insurance?",
    a: "Yes. All contractors must carry at least $500k in general liability insurance. This protects both you and the homeowners you serve. We verify coverage during onboarding.",
  },
];

function Contractors() {
  const [formState, setFormState] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    serviceType: "",
    yearsExperience: "",
    licenseNumber: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitContractorApplication(formState);
      setSubmitted(true);
    } catch {
      // Silently handle — submission is best-effort
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Grow your business with ServiceHQ
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-blue-100 sm:text-xl">
            Join Tennessee's trusted home-services platform and connect with
            homeowners who need your skills.
          </p>
          <a
            href="#contractor-form"
            className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-md transition hover:bg-blue-50"
          >
            Apply now
          </a>
        </div>
      </header>

      {/* ── Why ServiceHQ ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Why ServiceHQ?
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="text-4xl">{b.emoji}</div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {b.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How You Get Paid ── */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How you get paid
          </h2>
          <div className="mt-10 space-y-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Set your rates</h3>
                <p className="text-sm text-gray-500">
                  You set your own pricing within our platform guidelines. We
                  provide rate recommendations based on your market.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Complete the job</h3>
                <p className="text-sm text-gray-500">
                  The homeowner pays through the platform when the job is done.
                  ServiceHQ deducts a 15–20% service fee; you keep 80–85%.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Fast payout</h3>
                <p className="text-sm text-gray-500">
                  Payments are processed within 48 hours of job completion.
                  Direct deposit to your bank account — no waiting, no chasing
                  invoices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Types of Jobs ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Types of jobs you'll receive
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {jobTypes.map((j) => (
              <div
                key={j.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="text-3xl">{j.emoji}</div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">
                  {j.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{j.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Requirements ── */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Requirements
          </h2>
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <ul className="space-y-3">
              {requirements.map((req) => (
                <li key={req} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Vetting & Onboarding ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Vetting &amp; onboarding
          </h2>
          <p className="mt-3 text-center text-gray-500">
            From application to your first job — here's what to expect.
          </p>
          <div className="mt-10 space-y-4">
            {onboardingSteps.map((s) => (
              <div
                key={s.step}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA / Application Form ── */}
      <section id="contractor-form" className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-lg px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to join?
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Fill out the form below and we'll be in touch to start your
            onboarding.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
              <div className="text-4xl">✅</div>
              <h3 className="mt-4 text-xl font-semibold text-green-800">
                Application received!
              </h3>
              <p className="mt-2 text-green-600">
                Thanks for your interest in joining ServiceHQ. We'll review your
                application and reach out within 2–3 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formState.name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label
                  htmlFor="companyName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Company name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formState.companyName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formState.email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formState.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label
                  htmlFor="serviceType"
                  className="block text-sm font-medium text-gray-700"
                >
                  Service type
                </label>
                <select
                  id="serviceType"
                  name="serviceType"
                  required
                  value={formState.serviceType}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select a service…
                  </option>
                  <option value="repairs">🔧 Repairs</option>
                  <option value="cleaning">🧹 Cleaning</option>
                  <option value="lawn-care">🌿 Lawn Care</option>
                  <option value="maintenance">🏠 Maintenance</option>
                  <option value="exterior">🏡 Exterior Services</option>
                  <option value="safety">🛡️ Home Safety</option>
                  <option value="organization">📦 Home Organization</option>
                  <option value="pet-services">🐾 Pet Services</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="yearsExperience"
                  className="block text-sm font-medium text-gray-700"
                >
                  Years of experience
                </label>
                <select
                  id="yearsExperience"
                  name="yearsExperience"
                  required
                  value={formState.yearsExperience}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  <option value="2-5">2–5 years</option>
                  <option value="5-10">5–10 years</option>
                  <option value="10-15">10–15 years</option>
                  <option value="15+">15+ years</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="licenseNumber"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tennessee business license number
                </label>
                <input
                  id="licenseNumber"
                  name="licenseNumber"
                  type="text"
                  required
                  value={formState.licenseNumber}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="License number"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-medium text-gray-900">{faq.q}</span>
                  <span className="ml-4 shrink-0 text-lg text-gray-400 transition-transform duration-200"
                    style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="border-t border-gray-100 px-5 pb-4 pt-1">
                    <p className="text-sm text-gray-500">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-gray-900 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          ServiceHQ — Serving Tennessee homeowners
        </p>
        <p className="mt-1 text-sm">&copy; 2025 ServiceHQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
