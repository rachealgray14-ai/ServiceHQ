import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ensureDatabaseSchema } from "../db/schema";
import { sql } from "../db";

/* ──────────────────────────────────────────────────────────────
 * Server-side: look up a booking by service_request id
 * ────────────────────────────────────────────────────────────── */

const getBooking = createServerFn({ method: "POST" }).handler(
  async (data: { id: number }) => {
    await ensureDatabaseSchema();
    const q = sql();
    const [row] = await q`
      SELECT sr.id AS request_id, sr.name, sr.email, sr.phone, sr.service_type,
             sr.message, sr.status AS request_status, sr.created_at,
             j.id AS job_id, j.status AS job_status, j.scheduled_at,
             c.address, c.city, c.tn_county
      FROM service_requests sr
      LEFT JOIN jobs j ON j.service_request_id = sr.id
      LEFT JOIN customers c ON c.id = sr.customer_id
      WHERE sr.id = ${data.id}`;
    if (!row) return null;
    const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
    return {
      requestId: row.request_id as number,
      name: row.name as string,
      email: row.email as string,
      phone: row.phone as string,
      serviceType: row.service_type as string,
      message: row.message as string,
      requestStatus: row.request_status as string,
      createdAt: iso(row.created_at),
      jobId: row.job_id == null ? null : (row.job_id as number),
      jobStatus: row.job_status == null ? null : (row.job_status as string),
      scheduledAt: iso(row.scheduled_at),
      address: row.address,
      city: row.city,
      tnCounty: row.tn_county,
    };
  },
);

export const Route = createFileRoute("/booking-confirmed")({
  component: BookingConfirmedPage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function BookingConfirmedPage() {
  const search = Route.useSearch() as { id?: string };
  const rawId = Array.isArray(search.id) ? search.id[0] : search.id;
  const id = rawId ? Number(rawId) : NaN;

  const [booking, setBooking] = useState<Awaited<ReturnType<typeof getBooking>>>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    getBooking({ id }).then((res) => {
      if (res) setBooking(res);
      else setNotFound(true);
      setLoading(false);
    });
  }, [id]);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <a href="/" className="text-sm font-medium text-blue-100 hover:text-white">
            ← Back to ServiceHQ
          </a>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Booking status
          </h1>
          <p className="mt-3 max-w-xl text-blue-100">
            Track your service request and see what happens next.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 sm:py-14">
        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading…</p>
        ) : notFound || !booking ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="text-4xl">🔎</div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Booking not found</h2>
            <p className="mt-2 text-sm text-gray-500">
              We couldn't find a booking for that reference number.
            </p>
            <a
              href="/book"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              Book a service
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm sm:p-10">
              <div className="text-5xl">✅</div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                Booking #{booking.requestId}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                We'll match you with a vetted pro and confirm within 24 hours.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-sm font-semibold text-gray-900">Service</h3>
              </div>
              <dl className="divide-y divide-gray-50 px-6">
                <Row label="Service type" value={titleCase(booking.serviceType)} />
                <Row label="Details" value={booking.message || "—"} />
                {booking.scheduledAt && (
                  <Row label="Requested date" value={fmtDate(booking.scheduledAt)} />
                )}
                <Row label="Request status" value={titleCase(booking.requestStatus)} />
                {booking.jobStatus && (
                  <Row label="Job status" value={titleCase(booking.jobStatus)} />
                )}
              </dl>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-sm font-semibold text-gray-900">Your details</h3>
              </div>
              <dl className="divide-y divide-gray-50 px-6">
                <Row label="Name" value={booking.name} />
                <Row label="Email" value={booking.email} />
                <Row label="Phone" value={booking.phone} />
                <Row
                  label="Address"
                  value={[booking.address, booking.city, booking.tnCounty]
                    .filter(Boolean)
                    .map((s) => s + (s === booking.tnCounty ? " County" : ""))
                    .join(", ")}
                />
                <Row
                  label="Placed on"
                  value={booking.createdAt ? fmtDate(booking.createdAt) : "—"}
                />
              </dl>
            </div>

            <div className="flex justify-center">
              <a
                href="/"
                className="inline-block rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-700"
              >
                Back to home
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto bg-gray-900 py-10 text-center text-gray-400">
        <p className="text-sm font-medium text-white">
          ServiceHQ — Serving homeowners across Tennessee
        </p>
        <p className="mt-1 text-sm">&copy; 2025 ServiceHQ. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
