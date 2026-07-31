import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile, appendFile } from "node:fs/promises";
import { useState } from "react";

// Read the business name from site.json at request time.
const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "ServiceHQ";
  } catch {
    return "ServiceHQ";
  }
});

// Handle service request form submissions — append as newline-delimited JSON.
const submitServiceRequest = createServerFn({ method: "POST" })
  .handler(async (data: { name: string; email: string; phone: string; serviceType: string; message: string }) => {
    const entry = {
      ...data,
      submittedAt: new Date().toISOString(),
    };
    await appendFile(
      "/home/team/shared/service-requests.json",
      JSON.stringify(entry) + "\n",
      "utf8"
    );
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
    description: "Inspections, preventative upkeep, seasonal checkups",
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
            Connecting Tennessee homeowners with vetted local contractors for
            repairs, cleaning, lawn care, and maintenance.
          </p>
          <a
            href="#request-form"
            className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-md transition hover:bg-blue-50"
          >
            Request a Service
          </a>
        </div>
      </header>

      {/* ── Service Categories ── */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What we handle
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── How It Works ── */}
      <section className="bg-gray-50 py-16 sm:py-24">
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
      <section id="request-form" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-lg px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Request a service
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Tell us what you need and we'll match you with the right pro.
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

      {/* ── Footer ── */}
      <footer className="mt-auto bg-gray-900 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          {businessName} — Serving Tennessee homeowners
        </p>
        <p className="mt-1 text-sm">&copy; 2025 {businessName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
