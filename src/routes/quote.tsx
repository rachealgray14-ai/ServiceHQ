import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/quote")({
  component: QuotePage,
});

type Range = [number, number];

type Option = {
  value: string;
  label: string;
  hint?: string;
  // A price sets the base estimate range; mult scales the running range;
  // add shifts it. All ranges are in dollars.
  price?: Range;
  mult?: Range;
  add?: Range;
  note?: string;
};

type Question = {
  key: string;
  label: string;
  options: Option[];
  showIf?: (answers: Record<string, string>) => boolean;
};

type Category = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  questions: Question[];
};

// Pricing mirrors the "Transparent Pricing" data on the landing page
// (src/routes/index.tsx) so quotes stay consistent with published rates.
const categories: Category[] = [
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
          { value: "plumbing", label: "Plumbing", hint: "$85–150/hr", price: [85, 150] },
          { value: "electrical", label: "Electrical", hint: "$90–160/hr", price: [90, 160] },
          {
            value: "hvac",
            label: "HVAC",
            hint: "$95–175/hr",
            price: [95, 175],
            note: "A diagnostic-only visit may be billed flat at $75–125.",
          },
          {
            value: "handyman",
            label: "Handyman",
            hint: "$65–95/hr",
            price: [65, 95],
            note: "Handyman work typically has a $150 minimum.",
          },
        ],
      },
      {
        key: "emergency",
        label: "Is this an emergency?",
        options: [
          { value: "no", label: "No — routine", mult: [1, 1] },
          {
            value: "yes",
            label: "Yes — urgent",
            mult: [1.5, 1.5],
            note: "Emergency rates apply — emergency plumbing, for example, runs $150–250/hr.",
          },
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
          { value: "standard", label: "Standard clean", hint: "$120–250", price: [120, 250] },
          { value: "deep", label: "Deep clean", hint: "$250–500", price: [250, 500] },
          { value: "move", label: "Move in/out", hint: "$300–600", price: [300, 600] },
        ],
      },
      {
        key: "size",
        label: "Home size",
        options: [
          { value: "small", label: "Small apartment", mult: [0.7, 0.75] },
          { value: "medium", label: "Medium house", mult: [1, 1] },
          { value: "large", label: "Large house", mult: [1.4, 1.5] },
        ],
      },
      {
        key: "recurring",
        label: "How often?",
        options: [
          { value: "one-time", label: "One-time", mult: [1, 1] },
          {
            value: "weekly",
            label: "Weekly",
            mult: [0.85, 0.9],
            note: "Recurring cleans save 10–15%.",
          },
          {
            value: "biweekly",
            label: "Biweekly",
            mult: [0.85, 0.9],
            note: "Recurring cleans save 10–15%.",
          },
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
          { value: "mowing", label: "Mowing", hint: "$35–75/visit", price: [35, 75] },
          { value: "landscaping", label: "Landscaping", hint: "$150–500+", price: [150, 500] },
          { value: "cleanup", label: "Seasonal cleanup", hint: "$200–600", price: [200, 600] },
          {
            value: "fertilization",
            label: "Fertilization",
            hint: "$50–100/treatment",
            price: [50, 100],
          },
        ],
      },
      {
        key: "yard",
        label: "Yard size",
        options: [
          { value: "small", label: "Small yard", mult: [0.7, 0.75] },
          { value: "medium", label: "Medium yard", mult: [1, 1] },
          { value: "large", label: "Large yard", mult: [1.4, 1.5] },
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
          { value: "appliance-diagnostic", label: "Appliance diagnostic", hint: "$75–125", price: [75, 125] },
          { value: "appliance-repair", label: "Appliance repair", hint: "$50–150/hr", price: [50, 150] },
          { value: "appliance-install", label: "Appliance install", hint: "$100–300", price: [100, 300] },
          { value: "hvac-tuneup", label: "HVAC tune-up", hint: "$75–150", price: [75, 150] },
          { value: "gutter-cleaning", label: "Gutter cleaning", hint: "$100–250", price: [100, 250] },
          { value: "home-inspection", label: "Home inspection", hint: "$200–400", price: [200, 400] },
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
          { value: "pw-house", label: "Pressure wash — house", hint: "$150–400", price: [150, 400] },
          { value: "pw-driveway", label: "Pressure wash — driveway", hint: "$75–150", price: [75, 150] },
          { value: "pw-deck", label: "Pressure wash — deck", hint: "$100–250", price: [100, 250] },
          { value: "windows", label: "Window cleaning", hint: "$150–400", price: [150, 400] },
        ],
      },
      {
        key: "area",
        label: "How large is the area?",
        showIf: (a) => (a.service ?? "").startsWith("pw-"),
        options: [
          { value: "small", label: "Small", mult: [0.75, 0.8] },
          { value: "medium", label: "Medium", mult: [1, 1] },
          { value: "large", label: "Large", mult: [1.3, 1.5] },
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
          { value: "inspection", label: "Safety inspection", hint: "$150–300", price: [150, 300] },
          { value: "detectors", label: "Smoke/CO detectors", hint: "$75–200", price: [75, 200] },
          { value: "childproofing", label: "Childproofing", hint: "$200–600", price: [200, 600] },
          { value: "security", label: "Security consult", hint: "$100–200", price: [100, 200] },
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
          { value: "closet", label: "Closet", hint: "$200–500", price: [200, 500] },
          { value: "garage", label: "Garage", hint: "$300–800", price: [300, 800] },
          { value: "whole-home", label: "Whole-home", hint: "$500–2,000+", price: [500, 2000] },
        ],
      },
      {
        key: "consult",
        label: "Would you like a decluttering consultation?",
        options: [
          { value: "no", label: "No", add: [0, 0] },
          {
            value: "yes",
            label: "Yes",
            add: [100, 200],
            note: "Decluttering consultations run $100–200/hr.",
          },
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
          { value: "walking", label: "Dog walking", hint: "$20–30/30min", price: [20, 30] },
          { value: "sitting", label: "Pet sitting", hint: "$40–75/day", price: [40, 75] },
          { value: "cleanup", label: "Waste cleanup", hint: "$50–100/mo", price: [50, 100] },
          { value: "grooming", label: "Grooming", hint: "$40–90", price: [40, 90] },
        ],
      },
      {
        key: "frequency",
        label: "How often?",
        options: [
          { value: "one-time", label: "One-time", mult: [1, 1] },
          {
            value: "recurring",
            label: "Recurring",
            mult: [0.9, 1],
            note: "Recurring schedules may qualify for discounted rates.",
          },
        ],
      },
    ],
  },
];

const steps = ["Category", "Details", "Estimate"];

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function computeEstimate(
  category: Category,
  answers: Record<string, string>
): { low: number; high: number; notes: string[] } | null {
  const visible = category.questions.filter((q) => !q.showIf || q.showIf(answers));
  for (const q of visible) {
    if (!answers[q.key]) return null;
  }
  let low = 0;
  let high = 0;
  let hasBase = false;
  const notes: string[] = [];
  for (const q of visible) {
    const opt = q.options.find((o) => o.value === answers[q.key]);
    if (!opt) continue;
    if (opt.price) {
      low = opt.price[0];
      high = opt.price[1];
      hasBase = true;
    }
    if (opt.mult) {
      low = low * opt.mult[0];
      high = high * opt.mult[1];
    }
    if (opt.add) {
      low = low + opt.add[0];
      high = high + opt.add[1];
    }
    if (opt.note) notes.push(opt.note);
  }
  if (!hasBase) return null;
  return { low, high, notes };
}

function selectedLabels(category: Category, answers: Record<string, string>): string {
  const visible = category.questions.filter((q) => !q.showIf || q.showIf(answers));
  const labels = visible
    .map((q) => q.options.find((o) => o.value === answers[q.key])?.label)
    .filter(Boolean);
  return labels.join(" · ");
}

function QuotePage() {
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const visibleQuestions =
    category?.questions.filter((q) => !q.showIf || q.showIf(answers)) ?? [];
  const allAnswered = visibleQuestions.every((q) => answers[q.key]);
  const estimate = category && allAnswered ? computeEstimate(category, answers) : null;

  const startOver = () => {
    setStep(1);
    setCategoryId(null);
    setAnswers({});
  };

  const pickCategory = (id: string) => {
    setCategoryId(id);
    setAnswers({});
  };

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      // Drop answers to questions that are no longer visible (e.g. switching
      // away from a pressure-wash service hides the "area size" question).
      const visible = (categories.find((c) => c.id === categoryId)?.questions ?? []).filter(
        (q) => !q.showIf || q.showIf(next)
      );
      for (const q of categories.find((c) => c.id === categoryId)?.questions ?? []) {
        if (!visible.includes(q)) delete next[q.key];
      }
      return next;
    });
  };

  const progress = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <a href="/" className="text-sm font-medium text-blue-100 hover:text-white">
            ← Back to ServiceHQ
          </a>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Get your instant quote
          </h1>
          <p className="mt-3 max-w-xl text-blue-100">
            Answer a few quick questions and we'll show you a typical price range
            for your project — anywhere in Tennessee.
          </p>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between text-xs font-medium sm:text-sm">
            {steps.map((label, i) => {
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
                  <span className={active ? "font-semibold" : ""}>
                    Step {n}: {label}
                  </span>
                </div>
              );
            })}
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
        {/* Step 1: Category */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              What do you need help with?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Choose the category that best fits your project.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {categories.map((c) => {
                const selected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCategory(c.id)}
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
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Contextual questions */}
        {step === 2 && category && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
              {category.emoji} {category.title} — a few details
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {category.description}
            </p>
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
                          {opt.hint && (
                            <span
                              className={`ml-2 text-xs ${
                                selected ? "text-indigo-600" : "text-gray-400"
                              }`}
                            >
                              {opt.hint}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                disabled={!allAnswered}
                onClick={() => setStep(3)}
                className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                See my estimate
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Estimate */}
        {step === 3 && category && estimate && (
          <div>
            <div className="rounded-2xl border border-indigo-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div className="text-5xl">{category.emoji}</div>
              <h2 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">
                Your estimated range
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {category.title} — {selectedLabels(category, answers)}
              </p>
              <p className="mt-6 text-4xl font-bold tracking-tight text-indigo-700 sm:text-5xl">
                {fmt(estimate.low)}–{fmt(estimate.high)}
              </p>
              {estimate.notes.length > 0 && (
                <ul className="mx-auto mt-6 max-w-md space-y-1.5 text-left">
                  {estimate.notes.map((note) => (
                    <li key={note} className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="mt-0.5 shrink-0 text-indigo-500">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                This is an estimate based on typical rates in Tennessee. Final
                pricing confirmed after consultation.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={`/book?service=${category.id}`}
                className="inline-block rounded-lg bg-indigo-600 px-8 py-3 text-center font-semibold text-white shadow-md transition hover:bg-indigo-700"
              >
                Book This Service
              </a>
              <button
                type="button"
                onClick={startOver}
                className="rounded-lg border border-gray-300 bg-white px-8 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Start Over
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-gray-500">
              Want to see a different service?{" "}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Choose another category
              </button>
            </p>
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
