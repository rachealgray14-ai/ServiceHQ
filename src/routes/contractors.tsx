import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ensureDatabaseSchema } from "../db/schema";
import { sql } from "../db";
import {
  TN_COUNTIES,
  normalizeCountyList,
  toPgTextArray,
} from "../lib/tn-counties";

/* ──────────────────────────────────────────────────────────────
 * Server-side: store a contractor application.
 *
 * `tn_counties` is required input, not a default: routing treats an empty
 * array as "serves all of Tennessee", so an application that never says where
 * it works must be rejected here rather than silently becoming statewide.
 * ────────────────────────────────────────────────────────────── */

type ApplicationInput = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  serviceType: string;
  yearsExperience: string;
  licenseNumber: string;
  /** Counties the applicant ticked. Ignored when `servesStatewide` is true. */
  tnCounties: string[];
  /** "I serve all of Tennessee" — stored as an empty `tn_counties` array. */
  servesStatewide: boolean;
};

const submitContractorApplication = createServerFn({ method: "POST" })
  // Declares the payload type for the caller; `readApplication` below is what
  // actually validates and normalizes it on the server.
  .validator((input: unknown) => input as ApplicationInput)
  .handler(async ({ data }) => {
    // TanStack passes the caller's payload as `ctx.data`, so read it defensively
    // rather than trusting its shape.
    const input = readApplication(data);
    if (!input) {
      return {
        success: false,
        error: "We couldn't read that application. Please reload the page and try again.",
        counties: [] as string[],
        servesStatewide: false,
      };
    }
    const counties = input.servesStatewide
      ? []
      : normalizeCountyList(input.tnCounties);
    if (!input.servesStatewide && counties.length === 0) {
      return {
        success: false,
        error:
          "Choose at least one county you serve, or tick “I serve all of Tennessee”.",
        counties: [] as string[],
        servesStatewide: false,
      };
    }
    if (
      !input.name ||
      !input.companyName ||
      !input.email ||
      !input.phone ||
      !input.serviceType
    ) {
      return {
        success: false,
        error: "Please fill in your name, company, email, phone and service type.",
        counties: [] as string[],
        servesStatewide: input.servesStatewide,
      };
    }
    await ensureDatabaseSchema();
    await sql()`INSERT INTO contractors
      (name, company_name, email, phone, service_type, years_experience, license_number, tn_counties)
      VALUES (${input.name}, ${input.companyName}, ${input.email}, ${input.phone}, ${input.serviceType}, ${parseExperience(input.yearsExperience)}, ${input.licenseNumber}, ${toPgTextArray(counties)}::text[])`;
    return {
      success: true,
      error: "",
      counties: counties as string[],
      servesStatewide: input.servesStatewide,
    };
  });

/** Coerce the incoming payload to the shape the insert expects. */
function readApplication(raw: unknown): ApplicationInput | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  return {
    name: str(v.name),
    companyName: str(v.companyName),
    email: str(v.email),
    phone: str(v.phone),
    serviceType: str(v.serviceType),
    yearsExperience: str(v.yearsExperience),
    licenseNumber: str(v.licenseNumber),
    tnCounties: Array.isArray(v.tnCounties) ? v.tnCounties.map(String) : [],
    servesStatewide: v.servesStatewide === true,
  };
}

function parseExperience(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export const Route = createFileRoute("/contractors")({
  component: Contractors,
});

/* ── Copy ──
 * Every claim below is something ServiceHQ can do today: route bookings to
 * contractors by service type and county, and review applications by hand.
 * There is no payment integration, no contractor portal, no messaging and no
 * review system — so none of those are mentioned.
 */

const benefits = [
  {
    emoji: "🎉",
    title: "Founding rate: 10% commission",
    description:
      "The first ten contractors on ServiceHQ pay a 10% commission on completed jobs. After that, the standard rate is 15–20%. Joining is free — no sign-up fees, no monthly dues.",
  },
  {
    emoji: "🌿",
    title: "Lawn care in Davidson County first",
    description:
      "We're signing up lawn-care pros in Nashville / Davidson County first. Contractors elsewhere in Tennessee are welcome to apply — we'll onboard as we expand.",
  },
  {
    emoji: "📍",
    title: "Jobs come to you by county",
    description:
      "New bookings are routed to contractors who do that service in the booking's county. You tell us which counties you cover, and we only send you work there.",
  },
  {
    emoji: "💵",
    title: "You set your own rates",
    description:
      "You price your own work within ServiceHQ's platform guidelines. We don't set your rates for you.",
  },
];

const jobTypes = [
  {
    emoji: "🌿",
    title: "Lawn Care",
    description: "Mowing, landscaping, seasonal cleanup, and fertilization treatments.",
  },
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
  "2+ years professional experience",
  "Reliable transportation and your own tools",
  "Willing to complete a background check",
];

/** Honest, capability-free version of "what happens next". */
const nextSteps = [
  {
    step: 1,
    title: "We review your application",
    description:
      "A person at ServiceHQ reads every application — it isn't auto-approved.",
  },
  {
    step: 2,
    title: "We check your license and insurance",
    description:
      "We look up the Tennessee business license number you give us and confirm your liability coverage.",
  },
  {
    step: 3,
    title: "We contact you directly",
    description:
      "We reach out by phone or email to talk through your experience and answer your questions.",
  },
  {
    step: 4,
    title: "We start routing jobs to you",
    description:
      "Once you're approved, new bookings for your service in the counties you picked are routed to you. There's no contractor portal yet, so we confirm the details of each job with you directly.",
  },
];

const faqs = [
  {
    q: "How much does it cost to join?",
    a: "Joining is free — no sign-up fees, no monthly dues, no listing charges. We earn a commission on completed jobs only: 10% for the first ten contractors on ServiceHQ, then the standard 15–20%.",
  },
  {
    q: "Where are you recruiting right now?",
    a: "Lawn care in Davidson County (Nashville) is our active focus, so that's where jobs will come first. If you work in another county or another service, apply anyway — your application goes on file and we onboard as we expand.",
  },
  {
    q: "How quickly will I get jobs?",
    a: "That depends on homeowner demand in your county and service. We can't promise a timeline. In Davidson County lawn care we're recruiting and building demand now; elsewhere it will grow as we expand.",
  },
  {
    q: "Can I choose which jobs I take?",
    a: "There's no contractor portal yet, so you won't be clicking accept or decline in an app. We contact you about a job before it's assigned, and we'll only send you work in the counties and service you applied for.",
  },
  {
    q: "Do I need my own insurance?",
    a: "Yes. All contractors must carry at least $500k in general liability insurance. This protects both you and the homeowners you serve, and we check coverage as part of the application review.",
  },
  {
    q: "What if something goes wrong on a job?",
    a: "Tell us. We keep a record of every job and dispute, review what happened with both sides, and work toward a fair resolution.",
  },
];

/** City nicknames that make the county search forgiving ("Nashville" → Davidson). */
const CITY_TO_COUNTY: Record<string, string> = {
  nashville: "Davidson",
  memphis: "Shelby",
  knoxville: "Knox",
  chattanooga: "Hamilton",
  clarksville: "Montgomery",
  murfreesboro: "Rutherford",
  franklin: "Williamson",
};

const INPUT_CLS =
  "mt-1 block min-h-[48px] w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";
const LABEL_CLS = "block text-sm font-medium text-gray-700";
const CHECKBOX_CLS =
  "h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500";

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
  const [counties, setCounties] = useState<string[]>([]);
  const [statewide, setStatewide] = useState(false);
  const [countySearch, setCountySearch] = useState("");
  const [showAllCounties, setShowAllCounties] = useState(false);
  const [submitted, setSubmitted] = useState<{
    counties: string[];
    servesStatewide: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const coverageChosen = statewide || counties.length > 0;

  const visibleCounties = useMemo(() => {
    const query = countySearch.trim().toLowerCase();
    if (!query) return showAllCounties ? [...TN_COUNTIES] : [];
    const alias = Object.keys(CITY_TO_COUNTY).find((city) => city.includes(query));
    const aliasCounty = alias ? CITY_TO_COUNTY[alias] : null;
    return TN_COUNTIES.filter(
      (c) => c.toLowerCase().includes(query) || c === aliasCounty,
    );
  }, [countySearch, showAllCounties]);

  const toggleCounty = (county: string) => {
    setCounties((prev) =>
      prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county],
    );
    setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverageChosen) {
      setSubmitError(
        "Choose at least one county you serve, or tick “I serve all of Tennessee”.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitContractorApplication({
        data: { ...formState, tnCounties: counties, servesStatewide: statewide },
      });
      if (result && result.success === false) {
        setSubmitError(result.error);
        return;
      }
      setSubmitted({
        counties: result?.counties ?? counties,
        servesStatewide: result?.servesStatewide ?? statewide,
      });
    } catch {
      setSubmitError(
        "Something went wrong saving your application. Please try again, or call us if it keeps failing.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-20 lg:py-28">
          <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
            Founding rate: first ten contractors pay 10% commission
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Grow your business with ServiceHQ
          </h1>
          <p className="mt-4 max-w-2xl text-base text-blue-100 sm:text-lg lg:text-xl">
            ServiceHQ connects Tennessee homeowners with vetted local
            contractors. We're signing up lawn-care pros in Nashville / Davidson
            County first — contractors across Tennessee can apply now.
          </p>
          <a
            href="#contractor-form"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-md transition hover:bg-blue-50 sm:mt-8"
          >
            Apply now
          </a>
        </div>
      </header>

      {/* ── Why ServiceHQ ── */}
      <section className="bg-white py-12 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Why ServiceHQ?
          </h2>
          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
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

      {/* ── What happens next ── */}
      <section className="bg-gray-50 py-12 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What happens next
          </h2>
          <p className="mt-3 text-center text-gray-500">
            From application to your first job — here's the whole process.
          </p>
          <div className="mt-8 space-y-4 sm:mt-10">
            {nextSteps.map((s) => (
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

      {/* ── Types of Jobs ── */}
      <section className="bg-white py-12 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Services on ServiceHQ
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Lawn care is where we're actively recruiting. Applications are open
            for every category.
          </p>
          <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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
      <section className="bg-gray-50 py-12 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Requirements
          </h2>
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:mt-10 sm:p-8">
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

      {/* ── CTA / Application Form ── */}
      <section id="contractor-form" className="bg-white py-12 sm:py-24">
        <div className="mx-auto max-w-lg px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Ready to join?
          </h2>
          <p className="mt-3 text-center text-gray-500">
            Fill out the form below and we'll review it and get in touch.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-xl border border-green-200 bg-green-50 p-6 text-center sm:p-8">
              <div className="text-4xl">✅</div>
              <h3 className="mt-4 text-xl font-semibold text-green-800">
                Application received
              </h3>
              <p className="mt-2 text-green-700">
                Thanks{formState.name ? `, ${formState.name.split(" ")[0]}` : ""} —
                your application is with us.{" "}
                {submitted.servesStatewide
                  ? "You told us you serve all of Tennessee."
                  : `You told us you serve ${
                      submitted.counties.length === 1
                        ? `${submitted.counties[0]} County`
                        : `${submitted.counties.length} counties (${submitted.counties.join(", ")})`
                    }.`}
              </p>
              <div className="mt-5 rounded-lg bg-white/70 p-4 text-left">
                <h4 className="text-sm font-semibold text-green-900">
                  What happens next
                </h4>
                <ul className="mt-2 space-y-1.5 text-sm text-green-800">
                  <li>We review your application by hand.</li>
                  <li>We check your Tennessee license and insurance.</li>
                  <li>
                    We contact you directly by phone or email to talk through your
                    experience.
                  </li>
                  <li>
                    Once you're approved, bookings for your service in your
                    counties are routed to you.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label htmlFor="name" className={LABEL_CLS}>
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formState.name}
                  onChange={handleChange}
                  className={INPUT_CLS}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label htmlFor="companyName" className={LABEL_CLS}>
                  Company name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  autoComplete="organization"
                  required
                  value={formState.companyName}
                  onChange={handleChange}
                  className={INPUT_CLS}
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label htmlFor="email" className={LABEL_CLS}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={formState.email}
                  onChange={handleChange}
                  className={INPUT_CLS}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className={LABEL_CLS}>
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={formState.phone}
                  onChange={handleChange}
                  className={INPUT_CLS}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="serviceType" className={LABEL_CLS}>
                  Service type
                </label>
                <select
                  id="serviceType"
                  name="serviceType"
                  required
                  value={formState.serviceType}
                  onChange={handleChange}
                  className={INPUT_CLS}
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

              {/* ── Counties served (required) ── */}
              <div>
                <span className={LABEL_CLS} id="counties-label">
                  Counties you serve{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                </span>
                <p className="mt-1 text-sm text-gray-500">
                  Required. Pick the counties you'll take work in, or tick
                  statewide. We only route jobs to you in the counties you choose.
                </p>

                <label className="mt-3 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    name="servesStatewide"
                    checked={statewide}
                    onChange={(e) => {
                      setStatewide(e.target.checked);
                      if (e.target.checked) {
                        setCounties([]);
                        setCountySearch("");
                      }
                      setSubmitError("");
                    }}
                    className={CHECKBOX_CLS}
                  />
                  <span className="text-base text-gray-900">
                    I serve all of Tennessee
                  </span>
                </label>

                {statewide ? (
                  <p className="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                    You'll be matched with jobs anywhere in Tennessee. Untick this
                    if you'd rather choose specific counties.
                  </p>
                ) : (
                  <>
                    {counties.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {counties.map((c) => (
                          <li key={c}>
                            <button
                              type="button"
                              onClick={() => toggleCounty(c)}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-indigo-100 px-3 text-sm font-medium text-indigo-800 transition hover:bg-indigo-200"
                            >
                              {c} County
                              <span aria-hidden="true">×</span>
                              <span className="sr-only">Remove {c} County</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <input
                      type="search"
                      name="countySearch"
                      value={countySearch}
                      onChange={(e) => setCountySearch(e.target.value)}
                      className={INPUT_CLS}
                      placeholder="Search counties (e.g. Davidson)"
                      aria-label="Search Tennessee counties"
                      autoComplete="off"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Tip: Nashville is in Davidson County.
                    </p>

                    {visibleCounties.length > 0 ? (
                      <ul
                        aria-labelledby="counties-label"
                        className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-300 bg-white"
                      >
                        {visibleCounties.map((c) => (
                          <li key={c}>
                            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2">
                              <input
                                type="checkbox"
                                checked={counties.includes(c)}
                                onChange={() => toggleCounty(c)}
                                className={CHECKBOX_CLS}
                              />
                              <span className="text-base text-gray-900">
                                {c} County
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        No county matches “{countySearch}”. Check the spelling, or
                        tick “I serve all of Tennessee” above.
                      </p>
                    )}

                    {!countySearch.trim() && !showAllCounties && (
                      <button
                        type="button"
                        onClick={() => setShowAllCounties(true)}
                        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-indigo-700 underline"
                      >
                        Browse all {TN_COUNTIES.length} counties
                      </button>
                    )}
                    {!countySearch.trim() && showAllCounties && (
                      <button
                        type="button"
                        onClick={() => setShowAllCounties(false)}
                        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-indigo-700 underline"
                      >
                        Hide county list
                      </button>
                    )}
                  </>
                )}
              </div>

              <div>
                <label htmlFor="yearsExperience" className={LABEL_CLS}>
                  Years of experience
                </label>
                <select
                  id="yearsExperience"
                  name="yearsExperience"
                  required
                  value={formState.yearsExperience}
                  onChange={handleChange}
                  className={INPUT_CLS}
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
                <label htmlFor="licenseNumber" className={LABEL_CLS}>
                  Tennessee business license number
                </label>
                <input
                  id="licenseNumber"
                  name="licenseNumber"
                  type="text"
                  autoComplete="off"
                  required
                  value={formState.licenseNumber}
                  onChange={handleChange}
                  className={INPUT_CLS}
                  placeholder="License number"
                />
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {submitError}
                </p>
              )}

              {!coverageChosen && (
                <p className="text-sm font-medium text-amber-700">
                  Choose at least one county, or tick “I serve all of Tennessee”,
                  to submit.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !coverageChosen}
                className="min-h-[48px] w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-12 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3 sm:mt-10">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex min-h-[52px] w-full items-center justify-between px-5 py-4 text-left"
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
      <footer className="mt-auto bg-gray-900 px-4 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          ServiceHQ — Serving homeowners across all of Tennessee
        </p>
        <p className="mt-1 text-sm">&copy; 2025 ServiceHQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
