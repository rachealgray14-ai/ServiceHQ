import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ensureDatabaseSchema } from "../db/schema";
import { sql } from "../db";

/* ──────────────────────────────────────────────────────────────
 * Server-side: create a booking (customer => service_request => job)
 * ────────────────────────────────────────────────────────────── */

type BookingInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tnCounty: string;
  serviceType: string;
  message: string;
  scheduledAt: string; // ISO-like "YYYY-MM-DDTHH:mm:ss" (window start)
};

const createBooking = createServerFn({ method: "POST" }).handler(
  async (data: BookingInput) => {
    await ensureDatabaseSchema();
    const q = sql();

    // Find or create the customer by email.
    let customerId: number;
    const [existing] = await q`SELECT id FROM customers WHERE email = ${data.email} LIMIT 1`;
    if (existing) {
      customerId = existing.id as number;
    } else {
      const [inserted] = await q`
        INSERT INTO customers (name, email, phone, address, city, tn_county)
        VALUES (${data.name}, ${data.email}, ${data.phone}, ${data.address},
                ${data.city}, ${data.tnCounty})
        RETURNING id`;
      customerId = inserted.id as number;
    }

    // Insert the service request, then the pending job (unassigned contractor).
    const [req] = await q`
      INSERT INTO service_requests (customer_id, name, email, phone, service_type, message)
      VALUES (${customerId}, ${data.name}, ${data.email}, ${data.phone},
              ${data.serviceType}, ${data.message})
      RETURNING id`;
    const [job] = await q`
      INSERT INTO jobs (service_request_id, customer_id, status, scheduled_at)
      VALUES (${req.id}, ${customerId}, 'pending', ${data.scheduledAt}::timestamptz)
      RETURNING id`;

    return { requestId: req.id as number, jobId: job.id as number };
  },
);

/* ──────────────────────────────────────────────────────────────
 * Booking data: 9 service categories with contextual questions
 * (mirrors the quote calculator) + all 95 TN counties
 * ────────────────────────────────────────────────────────────── */

type Option = { value: string; label: string };
type Question = {
  key: string;
  label: string;
  options: Option[];
  showIf?: (a: Record<string, string>) => boolean;
};
type Category = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  questions: Question[];
};

const CATEGORIES: Category[] = [
  {
    id: "repairs",
    emoji: "🔧",
    title: "Repairs",
    description: "Plumbing, electrical, HVAC, handyman",
    questions: [
      {
        key: "issue",
        label: "What type of issue?",
        options: [
          { value: "plumbing", label: "Plumbing" },
          { value: "electrical", label: "Electrical" },
          { value: "hvac", label: "HVAC" },
          { value: "handyman", label: "Handyman" },
        ],
      },
      {
        key: "emergency",
        label: "Is this an emergency?",
        options: [
          { value: "no", label: "No — routine" },
          { value: "yes", label: "Yes — urgent" },
        ],
      },
    ],
  },
  {
    id: "cleaning",
    emoji: "🧹",
    title: "Cleaning",
    description: "House cleaning, deep cleans, move-in/move-out",
    questions: [
      {
        key: "type",
        label: "What type of cleaning?",
        options: [
          { value: "standard", label: "Standard clean" },
          { value: "deep", label: "Deep clean" },
          { value: "move", label: "Move in/out" },
        ],
      },
      {
        key: "size",
        label: "Home size",
        options: [
          { value: "small", label: "Small apartment" },
          { value: "medium", label: "Medium house" },
          { value: "large", label: "Large house" },
        ],
      },
      {
        key: "recurring",
        label: "How often?",
        options: [
          { value: "one-time", label: "One-time" },
          { value: "weekly", label: "Weekly" },
          { value: "biweekly", label: "Biweekly" },
        ],
      },
    ],
  },
  {
    id: "lawn-care",
    emoji: "🌿",
    title: "Lawn Care",
    description: "Mowing, landscaping, seasonal cleanup",
    questions: [
      {
        key: "service",
        label: "What service do you need?",
        options: [
          { value: "mowing", label: "Mowing" },
          { value: "landscaping", label: "Landscaping" },
          { value: "cleanup", label: "Seasonal cleanup" },
          { value: "fertilization", label: "Fertilization" },
        ],
      },
      {
        key: "yard",
        label: "Yard size",
        options: [
          { value: "small", label: "Small yard" },
          { value: "medium", label: "Medium yard" },
          { value: "large", label: "Large yard" },
        ],
      },
    ],
  },
  {
    id: "maintenance",
    emoji: "🏠",
    title: "Maintenance",
    description: "Appliances, HVAC tune-ups, seasonal inspections, preventative upkeep",
    questions: [
      {
        key: "service",
        label: "What do you need?",
        options: [
          { value: "appliance-diagnostic", label: "Appliance diagnostic" },
          { value: "appliance-repair", label: "Appliance repair" },
          { value: "appliance-install", label: "Appliance install" },
          { value: "hvac-tuneup", label: "HVAC tune-up" },
          { value: "gutter-cleaning", label: "Gutter cleaning" },
          { value: "home-inspection", label: "Home inspection" },
        ],
      },
    ],
  },
  {
    id: "exterior",
    emoji: "🏡",
    title: "Exterior Services",
    description: "Pressure washing, window cleaning, gutter cleaning, deck restoration",
    questions: [
      {
        key: "service",
        label: "What exterior service?",
        options: [
          { value: "pw-house", label: "Pressure wash — house" },
          { value: "pw-driveway", label: "Pressure wash — driveway" },
          { value: "pw-deck", label: "Pressure wash — deck" },
          { value: "windows", label: "Window cleaning" },
        ],
      },
      {
        key: "area",
        label: "How large is the area?",
        showIf: (a) => (a.service ?? "").startsWith("pw-"),
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
      },
    ],
  },
  {
    id: "safety",
    emoji: "🛡️",
    title: "Home Safety",
    description: "Safety inspections, smoke/CO detectors, childproofing, security consultations",
    questions: [
      {
        key: "service",
        label: "What do you need?",
        options: [
          { value: "inspection", label: "Safety inspection" },
          { value: "detectors", label: "Smoke/CO detectors" },
          { value: "childproofing", label: "Childproofing" },
          { value: "security", label: "Security consult" },
        ],
      },
    ],
  },
  {
    id: "organization",
    emoji: "📦",
    title: "Home Organization",
    description: "Closet, garage, whole-home organization, decluttering",
    questions: [
      {
        key: "area",
        label: "What area are you organizing?",
        options: [
          { value: "closet", label: "Closet" },
          { value: "garage", label: "Garage" },
          { value: "whole-home", label: "Whole-home" },
        ],
      },
      {
        key: "consult",
        label: "Would you like a decluttering consultation?",
        options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ],
      },
    ],
  },
  {
    id: "pet-services",
    emoji: "🐾",
    title: "Pet Services",
    description: "Dog walking, pet sitting, waste cleanup, grooming",
    questions: [
      {
        key: "service",
        label: "What pet service?",
        options: [
          { value: "walking", label: "Dog walking" },
          { value: "sitting", label: "Pet sitting" },
          { value: "cleanup", label: "Waste cleanup" },
          { value: "grooming", label: "Grooming" },
        ],
      },
      {
        key: "frequency",
        label: "How often?",
        options: [
          { value: "one-time", label: "One-time" },
          { value: "recurring", label: "Recurring" },
        ],
      },
    ],
  },
  {
    id: "other",
    emoji: "✨",
    title: "Other / Not sure",
    description: "Something else — tell us what you need",
    questions: [],
  },
];

const TN_COUNTIES = [
  "Anderson", "Bedford", "Benton", "Bledsoe", "Blount", "Bradley", "Campbell",
  "Cannon", "Carroll", "Carter", "Cheatham", "Chester", "Claiborne", "Clay",
  "Cocke", "Coffee", "Crockett", "Cumberland", "Davidson", "Decatur", "DeKalb",
  "Dickson", "Dyer", "Fayette", "Fentress", "Franklin", "Gibson", "Giles",
  "Grainger", "Greene", "Grundy", "Hamblen", "Hamilton", "Hancock", "Hardeman",
  "Hardin", "Hawkins", "Haywood", "Henderson", "Henry", "Hickman", "Houston",
  "Humphreys", "Jackson", "Jefferson", "Johnson", "Knox", "Lake", "Lauderdale",
  "Lawrence", "Lewis", "Lincoln", "Loudon", "Macon", "Madison", "Marion",
  "Marshall", "Maury", "McMinn", "McNairy", "Meigs", "Monroe", "Montgomery",
  "Moore", "Morgan", "Obion", "Overton", "Perry", "Pickett", "Polk", "Putnam",
  "Rhea", "Roane", "Robertson", "Rutherford", "Scott", "Sequatchie", "Sevier",
  "Shelby", "Smith", "Stewart", "Sullivan", "Sumner", "Tipton", "Trousdale",
  "Unicoi", "Union", "Van Buren", "Warren", "Washington", "Wayne", "Weakley",
  "White", "Williamson", "Wilson",
];

const TIME_WINDOWS = [
  { value: "morning", label: "Morning", range: "8am – 12pm" },
  { value: "afternoon", label: "Afternoon", range: "12pm – 4pm" },
  { value: "evening", label: "Evening", range: "4pm – 8pm" },
];
const WINDOW_START: Record<string, string> = {
  morning: "08",
  afternoon: "12",
  evening: "16",
};

const STEPS = ["Service", "Details", "Schedule", "Contact", "Confirm"];

export const Route = createFileRoute("/book")({
  component: BookPage,
});

function next14Days(): { date: Date; key: string }[] {
  const days: { date: Date; key: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    days.push({ date: d, key });
  }
  return days;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function selectedLabels(category: Category, answers: Record<string, string>): string {
  const visible = category.questions.filter((q) => !q.showIf || q.showIf(answers));
  return visible
    .map((q) => q.options.find((o) => o.value === answers[q.key])?.label)
    .filter(Boolean)
    .join(" · ");
}

function inputCls(): string {
  return "mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";
}

function BookPage() {
  const search = Route.useSearch() as { service?: string };
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState<string | null>(
    search.service && CATEGORIES.some((c) => c.id === search.service)
      ? (search.service as string)
      : null,
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [window, setWindow] = useState<string | null>(null);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    tnCounty: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ requestId: number; jobId: number } | null>(null);

  const category = CATEGORIES.find((c) => c.id === categoryId) ?? null;
  const visibleQuestions =
    category?.questions.filter((q) => !q.showIf || q.showIf(answers)) ?? [];
  const detailsComplete = category
    ? visibleQuestions.every((q) => answers[q.key]) && description.trim().length > 0
    : description.trim().length > 0;
  const contactComplete =
    contact.name && contact.email && contact.phone && contact.address && contact.city && contact.tnCounty;

  const days = next14Days();
  const progress = ((Math.min(step, 5) - 1) / (STEPS.length - 1)) * 100;

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      const visible = (CATEGORIES.find((c) => c.id === categoryId)?.questions ?? []).filter(
        (q) => !q.showIf || q.showIf(next),
      );
      for (const q of CATEGORIES.find((c) => c.id === categoryId)?.questions ?? []) {
        if (!visible.includes(q)) delete next[q.key];
      }
      return next;
    });
  };

  const handleContact = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setContact((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!contactComplete || !dateKey || !window || !category) return;
    setSubmitting(true);
    setError("");
    try {
      const scheduledAt = `${dateKey}T${WINDOW_START[window]}:00:00`;
      const res = await createBooking({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        city: contact.city,
        tnCounty: contact.tnCounty,
        serviceType: categoryId!,
        message:
          `${description}${Object.keys(answers).length ? `\n\nDetails: ${selectedLabels(category, answers)}` : ""}`.trim(),
        scheduledAt,
      });
      setResult(res);
      setStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDate = days.find((d) => d.key === dateKey)?.date ?? null;
  const windowLabel = TIME_WINDOWS.find((w) => w.value === window)?.label ?? null;

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <a href="/" className="text-sm font-medium text-blue-100 hover:text-white">
            ← Back to ServiceHQ
          </a>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Book a service
          </h1>
          <p className="mt-3 max-w-xl text-blue-100">
            Tell us what you need, pick a time, and we'll match you with a vetted
            local pro — anywhere in Tennessee.
          </p>
        </div>
      </header>

      {/* ── Progress steps ── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="hidden items-center justify-between text-xs font-medium sm:flex sm:text-sm">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-2 ${
                    active ? "text-indigo-700" : done ? "text-indigo-500" : "text-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${
                      active
                        ? "bg-indigo-600 text-white"
                        : done
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? "✓" : n}
                  </span>
                  <span className={active ? "font-semibold" : ""}>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between sm:hidden">
            <span className="text-sm font-semibold text-indigo-700">
              Step {Math.min(step, 5)} of {STEPS.length}: {STEPS[Math.min(step, 5) - 1]}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
        {/* Step 1: Service selection */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              What do you need help with?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Choose the category that best fits your project.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {CATEGORIES.map((c) => {
                const selected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(c.id);
                      setAnswers({});
                    }}
                    className={`rounded-xl border p-4 text-left shadow-sm transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500"
                        : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                    }`}
                  >
                    <div className="text-3xl">{c.emoji}</div>
                    <h3
                      className={`mt-3 text-sm font-semibold sm:text-base ${
                        selected ? "text-indigo-900" : "text-gray-900"
                      }`}
                    >
                      {c.title}
                    </h3>
                    <p className="mt-1 hidden text-xs text-gray-500 sm:block">
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-10 flex justify-end">
              <button
                type="button"
                disabled={!categoryId}
                onClick={() => setStep(2)}
                className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Service details (contextual questions + description) */}
        {step === 2 && category && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              {category.emoji} {category.title} — a few details
            </h2>
            <p className="mt-2 text-sm text-gray-500">{category.description}</p>

            {visibleQuestions.length > 0 && (
              <div className="mt-8 space-y-8">
                {visibleQuestions.map((q) => (
                  <div key={q.key}>
                    <h3 className="text-sm font-semibold text-gray-900">{q.label}</h3>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {q.options.map((opt) => {
                        const selected = answers[q.key] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAnswer(q.key, opt.value)}
                            className={`rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                              selected
                                ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500"
                                : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:shadow"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <label htmlFor="description" className="block text-sm font-semibold text-gray-900">
                Describe what you need
              </label>
              <textarea
                id="description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give us a few details about your project or issue…"
                className={inputCls()}
              />
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!detailsComplete}
                onClick={() => setStep(3)}
                className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & time */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              📅 Pick a date and time
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Choose from the next 14 days and a preferred time window.
            </p>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-900">Date</h3>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {days.map(({ date, key }) => {
                  const selected = dateKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDateKey(key)}
                      className={`flex flex-col items-center rounded-lg border py-3 shadow-sm transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500"
                          : "border-gray-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <span className="text-xs font-medium text-gray-500">
                        {WEEKDAYS[date.getDay()]}
                      </span>
                      <span className="mt-1 text-lg font-bold text-gray-900">
                        {date.getDate()}
                      </span>
                      <span className="text-xs text-gray-500">{MONTHS[date.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-900">Preferred time window</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                {TIME_WINDOWS.map((w) => {
                  const selected = window === w.value;
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setWindow(w.value)}
                      className={`rounded-lg border px-5 py-3 text-left shadow-sm transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500"
                          : "border-gray-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${selected ? "text-indigo-900" : "text-gray-900"}`}>
                        {w.label}
                      </div>
                      <div className={`text-xs ${selected ? "text-indigo-600" : "text-gray-400"}`}>
                        {w.range}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Available slots are shown across the window. We'll confirm an exact
                arrival time with your matched pro.
              </p>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!dateKey || !window}
                onClick={() => setStep(4)}
                className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact info */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              📇 Your contact information
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              So we can match you and confirm your booking.
            </p>
            <form
              className="mt-8 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(5);
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={contact.name}
                    onChange={handleContact}
                    className={inputCls()}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={contact.email}
                    onChange={handleContact}
                    className={inputCls()}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={contact.phone}
                  onChange={handleContact}
                  className={inputCls()}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Service address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  required
                  value={contact.address}
                  onChange={handleContact}
                  className={inputCls()}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    required
                    value={contact.city}
                    onChange={handleContact}
                    className={inputCls()}
                    placeholder="Nashville"
                  />
                </div>
                <div>
                  <label htmlFor="tnCounty" className="block text-sm font-medium text-gray-700">
                    Tennessee county
                  </label>
                  <select
                    id="tnCounty"
                    name="tnCounty"
                    required
                    value={contact.tnCounty}
                    onChange={handleContact}
                    className={inputCls()}
                  >
                    <option value="" disabled>
                      Select your county…
                    </option>
                    {TN_COUNTIES.map((c) => (
                      <option key={c} value={c}>
                        {c} County
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!contactComplete}
                  className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 5: Review & confirm */}
        {step === 5 && category && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              Review your booking
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Take a moment to make sure everything looks right.
            </p>

            <div className="mt-8 space-y-4">
              <ReviewRow label="Service" value={`${category.emoji} ${category.title}`} />
              {Object.keys(answers).length > 0 && (
                <ReviewRow label="Details" value={selectedLabels(category, answers)} />
              )}
              <ReviewRow label="Date" value={selectedDate ? fmtDate(selectedDate.toISOString()) : "—"} />
              <ReviewRow label="Time window" value={windowLabel ? `${windowLabel} (${TIME_WINDOWS.find((w) => w.value === window)?.range})` : "—"} />
              <ReviewRow label="Name" value={contact.name} />
              <ReviewRow label="Email" value={contact.email} />
              <ReviewRow label="Phone" value={contact.phone} />
              <ReviewRow label="Address" value={`${contact.address}, ${contact.city}, ${contact.tnCounty} County`} />
              <ReviewRow
                label="Description"
                value={description.split("\n\n")[0]}
                last
              />
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="rounded-lg bg-blue-600 px-10 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Booking…" : "Book Now"}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              By booking you agree to be matched with a vetted local professional.
              No payment is taken today.
            </p>
          </div>
        )}

        {/* Step 6: Confirmation */}
        {step === 6 && result && (
          <div>
            <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div className="text-5xl">🎉</div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                Booking received!
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Your booking reference is
              </p>
              <p className="mt-3 inline-block rounded-lg bg-indigo-50 px-6 py-3 font-mono text-2xl font-bold tracking-wider text-indigo-700">
                #{result.requestId}
              </p>
              <p className="mt-6 text-sm text-gray-600">
                We'll match you with a vetted pro and confirm within 24 hours.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href={`/booking-confirmed?id=${result.requestId}`}
                  className="inline-block rounded-lg bg-indigo-600 px-8 py-3 text-center font-semibold text-white shadow-md transition hover:bg-indigo-700"
                >
                  Track this booking
                </a>
                <a
                  href="/"
                  className="inline-block rounded-lg border border-gray-300 bg-white px-8 py-3 text-center font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Back to home
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-gray-900 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          ServiceHQ — Serving homeowners across Tennessee
        </p>
        <p className="mt-1 text-sm">&copy; 2025 ServiceHQ. All rights reserved.</p>
      </footer>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border bg-white px-5 py-4 ${
        last ? "border-indigo-100" : "border-gray-200"
      }`}
    >
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="text-right text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
