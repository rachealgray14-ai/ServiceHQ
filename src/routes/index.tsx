import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useState } from "react";
import { ensureDatabaseSchema } from "../db/schema";

// Read the business name from site.json at request time.
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureDatabaseSchema();
  } catch (error) {
    console.error("Database schema initialization skipped:", error);
  }
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "ServiceHQ";
  } catch {
    return "ServiceHQ";
  }
});

// Handle service request form submissions in Postgres.
const submitServiceRequest = createServerFn({ method: "POST" })
  .handler(async (data: { name: string; email: string; phone: string; serviceType: string; message: string }) => {
    await ensureDatabaseSchema();
    const { sql } = await import("../db");
    await sql()`INSERT INTO service_requests (name, email, phone, service_type, message)
      VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.serviceType}, ${data.message})`;
    return { success: true };
  });

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

const serviceCategories = [
  {
    emoji: "🔧",
    title: "Repairs",
    description: "Plumbing, electrical, HVAC, handyman",
  },
  {
    emoji: "🧹",
    title: "Cleaning",
    description: "House cleaning, deep cleans, move-in/move-out",
  },
  {
    emoji: "🌿",
    title: "Lawn Care",
    description: "Mowing, landscaping, seasonal cleanup",
  },
  {
    emoji: "🏠",
    title: "Maintenance",
    description: "Appliances, HVAC tune-ups, seasonal inspections, preventative upkeep",
  },
  {
    emoji: "🏡",
    title: "Exterior Services",
    description: "Pressure washing, window cleaning, gutter cleaning, deck restoration",
  },
  {
    emoji: "🛡️",
    title: "Home Safety",
    description: "Safety inspections, smoke/CO detectors, childproofing, security consultations",
  },
  {
    emoji: "📦",
    title: "Home Organization",
    description: "Closet, garage, whole-home organization, decluttering",
  },
  {
    emoji: "🐾",
    title: "Pet Services",
    description: "Dog walking, pet sitting, waste cleanup, grooming",
  },
];

const pricingCategories = [
  {
    title: "🔧 Repairs",
    items: [
      { label: "Plumbing", price: "$85–150/hr" },
      { label: "Emergency plumbing", price: "$150–250/hr" },
      { label: "Electrical", price: "$90–160/hr" },
      { label: "HVAC diagnostic", price: "$75–125 flat" },
      { label: "HVAC repair", price: "$95–175/hr" },
      { label: "Handyman", price: "$65–95/hr ($150 min)" },
    ],
  },
  {
    title: "🧹 Cleaning",
    items: [
      { label: "Standard clean", price: "$120–250" },
      { label: "Deep clean", price: "$250–500" },
      { label: "Move in/out", price: "$300–600" },
      { label: "Recurring discount", price: "10–15%" },
    ],
  },
  {
    title: "🌿 Lawn Care",
    items: [
      { label: "Mowing", price: "$35–75/visit" },
      { label: "Landscaping", price: "$150–500+" },
      { label: "Seasonal cleanup", price: "$200–600" },
      { label: "Fertilization", price: "$50–100/treatment" },
    ],
  },
  {
    title: "🏠 Maintenance",
    items: [
      { label: "Appliance diagnostic", price: "$75–125" },
      { label: "Appliance repair", price: "$50–150/hr" },
      { label: "Appliance install", price: "$100–300" },
      { label: "HVAC tune-up", price: "$75–150" },
      { label: "Gutter cleaning", price: "$100–250" },
      { label: "Home inspection", price: "$200–400" },
    ],
  },
  {
    title: "🏡 Exterior",
    items: [
      { label: "Pressure wash house", price: "$150–400" },
      { label: "Pressure wash driveway", price: "$75–150" },
      { label: "Pressure wash deck", price: "$100–250" },
      { label: "Window cleaning", price: "$150–400" },
    ],
  },
  {
    title: "📦 Home Organization",
    items: [
      { label: "Closet", price: "$200–500" },
      { label: "Garage", price: "$300–800" },
      { label: "Whole-home", price: "$500–2,000+" },
      { label: "Decluttering consult", price: "$100–200/hr" },
    ],
  },
  {
    title: "🛡️ Home Safety",
    items: [
      { label: "Safety inspection", price: "$150–300" },
      { label: "Smoke/CO detectors", price: "$75–200" },
      { label: "Childproofing", price: "$200–600" },
      { label: "Security consult", price: "$100–200" },
    ],
  },
  {
    title: "🐾 Pet Services",
    items: [
      { label: "Dog walking", price: "$20–30/30min" },
      { label: "Pet sitting", price: "$40–75/day" },
      { label: "Waste cleanup", price: "$50–100/mo" },
      { label: "Grooming", price: "$40–90" },
    ],
  },
];

const steps = [
  {
    number: 1,
    title: "Tell us what you need",
    description: "Fill out a quick form describing your home project or repair.",
  },
  {
    number: 2,
    title: "We match you with a vetted pro",
    description: "We connect you with a trusted, background-checked local contractor.",
  },
  {
    number: 3,
    title: "They show up, you pay through the platform",
    description: "Hassle-free scheduling and secure payment — all in one place.",
  },
];

function Home() {
  const businessName = Route.useLoaderData();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    serviceType: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitServiceRequest(formState);
      setSubmitted(true);
    } catch {
      // Silently handle — submission is best-effort
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Hero ── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your home, serviced right.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-blue-100 sm:text-xl">
            Connecting homeowners across all of Tennessee with vetted local
            contractors for repairs, cleaning, lawn care, and maintenance.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/quote"
              className="inline-block rounded-lg bg-white px-6 py-3 text-center font-semibold text-blue-700 shadow-md transition hover:bg-blue-50"
            >
              Get a Free Quote
            </a>
            <a
              href="#request-form"
              className="inline-block rounded-lg border border-white/70 bg-white/10 px-6 py-3 text-center font-semibold text-white shadow-md transition hover:bg-white/20"
            >
              Request a Service
            </a>
          </div>
        </div>
      </header>

      {/* ── Service Categories ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What we handle
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {serviceCategories.map((cat) => (
              <div
                key={cat.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="text-4xl">{cat.emoji}</div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {cat.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{cat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transparent Pricing ── */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Transparent Pricing
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Know what to expect before you book.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pricingCategories.map((cat) => (
              <div
                key={cat.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-base font-semibold text-gray-900">
                  {cat.title}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {cat.items.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="text-gray-600">{item.label}</span>
                      <span className="shrink-0 font-medium text-gray-900">
                        {item.price}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-gray-400">
            All prices are estimates. Final quotes provided after consultation.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white shadow-md">
                  {step.number}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request Service Form ── */}
      <section id="request-form" className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-lg px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Request a service
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Tell us what you need and we'll match you with the right pro —
            anywhere in Tennessee.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
              <div className="text-4xl">✅</div>
              <h3 className="mt-4 text-xl font-semibold text-green-800">
                Thank you!
              </h3>
              <p className="mt-2 text-green-600">
                We've received your request and will be in touch shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Name
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
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  value={formState.message}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Describe your project or issue…"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Submit Request"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Contractor CTA Banner ── */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-8 text-center sm:p-10">
            <h2 className="text-xl font-bold text-indigo-900 sm:text-2xl">
              Are you a home services professional?
            </h2>
            <p className="mt-2 text-indigo-700">
              Join ServiceHQ and grow your business. Connect with homeowners who need your skills.
            </p>
            <a
              href="/contractors"
              className="mt-5 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              Learn more for contractors
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-gray-900 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          {businessName} — Serving homeowners across all of Tennessee
        </p>
        <p className="mt-1 text-sm">&copy; 2025 {businessName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
