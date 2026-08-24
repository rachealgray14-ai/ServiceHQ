import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ensureDatabaseSchema } from "../db/schema";
import { sql } from "../db";

/* ──────────────────────────────────────────────────────────────
 * Server-side: auth + data access (all queries via server fns)
 * ────────────────────────────────────────────────────────────── */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "servicehq-admin";

function requireAuth(password: string) {
  if (password !== ADMIN_PASSWORD) throw new Error("Unauthorized");
}

const iso = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (v == null ? null : String(v));

type DbResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function withDb<T>(
  fn: (q: ReturnType<typeof sql>) => Promise<T>,
): Promise<DbResult<T>> {
  try {
    await ensureDatabaseSchema();
    const q = sql();
    const data = await fn(q);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const adminLogin = createServerFn({ method: "POST" }).handler(
  async (data: { password: string }) => ({ ok: data.password === ADMIN_PASSWORD }),
);

const adminOverview = createServerFn({ method: "POST" }).handler(
  async (data: { password: string }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const [statsRow] = await q`
        SELECT
          (SELECT COUNT(*)::int FROM service_requests) AS total_requests,
          (SELECT COUNT(*)::int FROM contractors WHERE status='active') AS active_contractors,
          (SELECT COUNT(*)::int FROM jobs WHERE status='completed') AS completed_jobs,
          (SELECT COALESCE(SUM(amount),0) FROM payments
             WHERE type='customer_payment' AND status='completed') AS revenue`;
      const requests = await q`
        SELECT id, name, email, service_type, status, created_at
        FROM service_requests ORDER BY created_at DESC LIMIT 10`;
      const breakdown = await q`
        SELECT status, COUNT(*)::int AS count FROM service_requests
        GROUP BY status ORDER BY count DESC`;
      const openDisputes = await q`
        SELECT COUNT(*)::int AS count FROM disputes WHERE status IN ('open','under_review')`;
      return {
        stats: {
          total_requests: Number(statsRow?.total_requests ?? 0),
          active_contractors: Number(statsRow?.active_contractors ?? 0),
          completed_jobs: Number(statsRow?.completed_jobs ?? 0),
          revenue: Number(statsRow?.revenue ?? 0),
          open_disputes: Number(openDisputes[0]?.count ?? 0),
        },
        recent: requests.map((r) => ({
          id: r.id as number,
          name: str(r.name),
          email: str(r.email),
          service_type: str(r.service_type),
          status: str(r.status),
          created_at: iso(r.created_at),
        })),
        breakdown: breakdown.map((b) => ({
          status: str(b.status),
          count: Number(b.count ?? 0),
        })),
      };
    });
  },
);

const adminJobs = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; status?: string | null }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const status = data.status || null;
      const rows = await q`
        SELECT j.id, j.status, j.scheduled_at, j.price_quoted, j.price_final, j.created_at,
               c.name AS customer_name, c.email AS customer_email,
               sr.service_type, sr.message,
               ct.name AS contractor_name, ct.company_name AS contractor_company
        FROM jobs j
        JOIN service_requests sr ON sr.id = j.service_request_id
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN contractors ct ON ct.id = j.contractor_id
        WHERE (${status} IS NULL OR j.status = ${status})
        ORDER BY j.created_at DESC`;
      return rows.map((r) => ({
        id: r.id as number,
        status: str(r.status),
        scheduled_at: iso(r.scheduled_at),
        price_quoted: num(r.price_quoted),
        price_final: num(r.price_final),
        created_at: iso(r.created_at),
        customer_name: str(r.customer_name),
        customer_email: str(r.customer_email),
        service_type: str(r.service_type),
        message: str(r.message),
        contractor_name: str(r.contractor_name),
        contractor_company: str(r.contractor_company),
      }));
    });
  },
);

const adminJobDetail = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; id: number }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const [job] = await q`
        SELECT j.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
               c.address AS customer_address, c.city AS customer_city, c.tn_county AS customer_county,
               ct.name AS contractor_name, ct.company_name AS contractor_company, ct.email AS contractor_email,
               sr.name AS requester_name, sr.email AS requester_email, sr.phone AS requester_phone,
               sr.service_type, sr.message, sr.status AS request_status
        FROM jobs j
        JOIN service_requests sr ON sr.id = j.service_request_id
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN contractors ct ON ct.id = j.contractor_id
        WHERE j.id = ${data.id}`;
      const contractors = await q`
        SELECT id, name, company_name, service_type, status
        FROM contractors WHERE status IN ('approved','active')
        ORDER BY name`;
      const payments = await q`
        SELECT id, amount, type, status, stripe_id, created_at
        FROM payments WHERE job_id = ${data.id} ORDER BY created_at DESC`;
      if (!job) return null;
      return {
        job: {
          id: job.id as number,
          status: str(job.status),
          scheduled_at: iso(job.scheduled_at),
          completed_at: iso(job.completed_at),
          price_quoted: num(job.price_quoted),
          price_final: num(job.price_final),
          platform_fee_pct: num(job.platform_fee_pct),
          created_at: iso(job.created_at),
          contractor_id: num(job.contractor_id),
          customer_name: str(job.customer_name),
          customer_email: str(job.customer_email),
          customer_phone: str(job.customer_phone),
          customer_address: str(job.customer_address),
          customer_city: str(job.customer_city),
          customer_county: str(job.customer_county),
          contractor_name: str(job.contractor_name),
          contractor_company: str(job.contractor_company),
          contractor_email: str(job.contractor_email),
          requester_name: str(job.requester_name),
          requester_email: str(job.requester_email),
          requester_phone: str(job.requester_phone),
          service_type: str(job.service_type),
          message: str(job.message),
          request_status: str(job.request_status),
        },
        contractors: contractors.map((c) => ({
          id: c.id as number,
          name: str(c.name),
          company_name: str(c.company_name),
          service_type: str(c.service_type),
          status: str(c.status),
        })),
        payments: payments.map((p) => ({
          id: p.id as number,
          amount: num(p.amount),
          type: str(p.type),
          status: str(p.status),
          stripe_id: str(p.stripe_id),
          created_at: iso(p.created_at),
        })),
      };
    });
  },
);

const adminUpdateJob = createServerFn({ method: "POST" }).handler(
  async (data: {
    password: string;
    id: number;
    status?: string | null;
    contractorId?: number | null;
    priceQuoted?: number | null;
  }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const [job] = await q`SELECT service_request_id, status FROM jobs WHERE id = ${data.id}`;
      if (!job) return { updated: false };
      let nextStatus = data.status ?? (job.status as string);
      const contractorId = data.contractorId ?? null;
      if (contractorId != null && nextStatus === "pending") nextStatus = "accepted";
      await q`
        UPDATE jobs SET
          status = ${nextStatus},
          contractor_id = COALESCE(${contractorId}, contractor_id),
          price_quoted = COALESCE(${data.priceQuoted ?? null}, price_quoted),
          completed_at = CASE WHEN ${nextStatus} = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
          updated_at = NOW()
        WHERE id = ${data.id}`;
      const requestStatus = jobStatusToRequestStatus(nextStatus);
      if (requestStatus) {
        await q`
          UPDATE service_requests SET status = ${requestStatus}, updated_at = NOW()
          WHERE id = ${job.service_request_id as number}`;
      }
      return { updated: true };
    });
  },
);

function jobStatusToRequestStatus(jobStatus: string): string | null {
  const map: Record<string, string> = {
    pending: "new",
    accepted: "assigned",
    in_progress: "in_progress",
    completed: "completed",
    cancelled: "cancelled",
    disputed: "in_progress",
  };
  return map[jobStatus] ?? null;
}

const adminContractors = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; status?: string | null }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const status = data.status || null;
      const rows = await q`
        SELECT id, name, company_name, email, phone, service_type, years_experience,
               license_number, insurance_info, status, service_radius_miles, tn_counties, created_at
        FROM contractors
        WHERE (${status} IS NULL OR status = ${status})
        ORDER BY created_at DESC`;
      return rows.map((r) => ({
        id: r.id as number,
        name: str(r.name),
        company_name: str(r.company_name),
        email: str(r.email),
        phone: str(r.phone),
        service_type: str(r.service_type),
        years_experience: num(r.years_experience),
        license_number: str(r.license_number),
        insurance_info: str(r.insurance_info),
        status: str(r.status),
        service_radius_miles: num(r.service_radius_miles),
        tn_counties: Array.isArray(r.tn_counties)
          ? (r.tn_counties as unknown[]).map((x) => String(x))
          : [],
        created_at: iso(r.created_at),
      }));
    });
  },
);

const adminContractorDetail = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; id: number }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const [c] = await q`SELECT * FROM contractors WHERE id = ${data.id}`;
      if (!c) return null;
      const [counts] = await q`
        SELECT COUNT(*)::int AS total_jobs,
               COUNT(*)::int FILTER (WHERE status = 'completed') AS completed_jobs
        FROM jobs WHERE contractor_id = ${data.id}`;
      const recentJobs = await q`
        SELECT j.id, j.status, j.price_final, j.created_at, c.name AS customer_name
        FROM jobs j JOIN customers c ON c.id = j.customer_id
        WHERE j.contractor_id = ${data.id}
        ORDER BY j.created_at DESC LIMIT 10`;
      return {
        contractor: {
          id: c.id as number,
          name: str(c.name),
          company_name: str(c.company_name),
          email: str(c.email),
          phone: str(c.phone),
          service_type: str(c.service_type),
          years_experience: num(c.years_experience),
          license_number: str(c.license_number),
          insurance_info: str(c.insurance_info),
          status: str(c.status),
          service_radius_miles: num(c.service_radius_miles),
          tn_counties: Array.isArray(c.tn_counties)
            ? (c.tn_counties as unknown[]).map((x) => String(x))
            : [],
          created_at: iso(c.created_at),
          updated_at: iso(c.updated_at),
        },
        counts: {
          total_jobs: Number(counts?.total_jobs ?? 0),
          completed_jobs: Number(counts?.completed_jobs ?? 0),
        },
        recent_jobs: recentJobs.map((j) => ({
          id: j.id as number,
          status: str(j.status),
          price_final: num(j.price_final),
          created_at: iso(j.created_at),
          customer_name: str(j.customer_name),
        })),
      };
    });
  },
);

const adminUpdateContractor = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; id: number; status: string }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      await q`
        UPDATE contractors SET status = ${data.status}, updated_at = NOW()
        WHERE id = ${data.id}`;
      return { updated: true };
    });
  },
);

const adminCustomers = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; search?: string | null }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const search = data.search?.trim() || null;
      const like = search ? `%${search}%` : null;
      const rows = await q`
        SELECT c.id, c.name, c.email, c.phone, c.address, c.city, c.tn_county, c.created_at,
               (SELECT COUNT(*)::int FROM service_requests sr WHERE sr.customer_id = c.id) AS request_count,
               (SELECT COUNT(*)::int FROM jobs j WHERE j.customer_id = c.id) AS job_count
        FROM customers c
        WHERE (${like} IS NULL
               OR c.name ILIKE ${like} OR c.email ILIKE ${like}
               OR c.phone ILIKE ${like} OR c.city ILIKE ${like})
        ORDER BY c.created_at DESC`;
      return rows.map((r) => ({
        id: r.id as number,
        name: str(r.name),
        email: str(r.email),
        phone: str(r.phone),
        address: str(r.address),
        city: str(r.city),
        tn_county: str(r.tn_county),
        created_at: iso(r.created_at),
        request_count: Number(r.request_count ?? 0),
        job_count: Number(r.job_count ?? 0),
      }));
    });
  },
);

const adminCustomerDetail = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; id: number }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const [c] = await q`SELECT * FROM customers WHERE id = ${data.id}`;
      if (!c) return null;
      const requests = await q`
        SELECT id, service_type, status, message, created_at
        FROM service_requests WHERE customer_id = ${data.id}
        ORDER BY created_at DESC LIMIT 20`;
      const jobs = await q`
        SELECT j.id, j.status, j.price_final, j.created_at,
               sr.service_type, ct.name AS contractor_name
        FROM jobs j
        JOIN service_requests sr ON sr.id = j.service_request_id
        LEFT JOIN contractors ct ON ct.id = j.contractor_id
        WHERE j.customer_id = ${data.id}
        ORDER BY j.created_at DESC LIMIT 20`;
      return {
        customer: {
          id: c.id as number,
          name: str(c.name),
          email: str(c.email),
          phone: str(c.phone),
          address: str(c.address),
          city: str(c.city),
          tn_county: str(c.tn_county),
          created_at: iso(c.created_at),
        },
        requests: requests.map((r) => ({
          id: r.id as number,
          service_type: str(r.service_type),
          status: str(r.status),
          message: str(r.message),
          created_at: iso(r.created_at),
        })),
        jobs: jobs.map((j) => ({
          id: j.id as number,
          status: str(j.status),
          price_final: num(j.price_final),
          created_at: iso(j.created_at),
          service_type: str(j.service_type),
          contractor_name: str(j.contractor_name),
        })),
      };
    });
  },
);

const adminPayments = createServerFn({ method: "POST" }).handler(
  async (data: { password: string; type?: string | null; status?: string | null }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const type = data.type || null;
      const status = data.status || null;
      const rows = await q`
        SELECT p.id, p.amount, p.type, p.status, p.stripe_id, p.created_at,
               j.id AS job_id, c.name AS customer_name, ct.name AS contractor_name
        FROM payments p
        JOIN jobs j ON j.id = p.job_id
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN contractors ct ON ct.id = j.contractor_id
        WHERE (${type} IS NULL OR p.type = ${type})
          AND (${status} IS NULL OR p.status = ${status})
        ORDER BY p.created_at DESC`;
      const [summary] = await q`
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(amount),0) AS total_amount,
               COUNT(*)::int FILTER (WHERE status = 'completed') AS completed,
               COALESCE(SUM(amount) FILTER (WHERE status = 'completed'),0) AS completed_amount,
               COUNT(*)::int FILTER (WHERE status = 'pending') AS pending,
               COALESCE(SUM(amount) FILTER (WHERE status = 'pending'),0) AS pending_amount,
               COUNT(*)::int FILTER (WHERE type = 'customer_payment') AS customer_payments,
               COUNT(*)::int FILTER (WHERE type = 'contractor_payout') AS payouts,
               COUNT(*)::int FILTER (WHERE type = 'refund') AS refunds
        FROM payments`;
      return {
        payments: rows.map((p) => ({
          id: p.id as number,
          amount: num(p.amount),
          type: str(p.type),
          status: str(p.status),
          stripe_id: str(p.stripe_id),
          created_at: iso(p.created_at),
          job_id: p.job_id as number,
          customer_name: str(p.customer_name),
          contractor_name: str(p.contractor_name),
        })),
        summary: {
          total: Number(summary?.total ?? 0),
          total_amount: Number(summary?.total_amount ?? 0),
          completed: Number(summary?.completed ?? 0),
          completed_amount: Number(summary?.completed_amount ?? 0),
          pending: Number(summary?.pending ?? 0),
          pending_amount: Number(summary?.pending_amount ?? 0),
          customer_payments: Number(summary?.customer_payments ?? 0),
          payouts: Number(summary?.payouts ?? 0),
          refunds: Number(summary?.refunds ?? 0),
        },
      };
    });
  },
);

const adminDisputes = createServerFn({ method: "POST" }).handler(
  async (data: { password: string }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      const rows = await q`
        SELECT d.id, d.job_id, d.raised_by, d.reason, d.status, d.resolution,
               d.created_at, d.updated_at,
               c.name AS customer_name, ct.name AS contractor_name
        FROM disputes d
        JOIN jobs j ON j.id = d.job_id
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN contractors ct ON ct.id = j.contractor_id
        ORDER BY d.created_at DESC`;
      return rows.map((d) => ({
        id: d.id as number,
        job_id: d.job_id as number,
        raised_by: str(d.raised_by),
        reason: str(d.reason),
        status: str(d.status),
        resolution: str(d.resolution),
        created_at: iso(d.created_at),
        updated_at: iso(d.updated_at),
        customer_name: str(d.customer_name),
        contractor_name: str(d.contractor_name),
      }));
    });
  },
);

const adminUpdateDispute = createServerFn({ method: "POST" }).handler(
  async (data: {
    password: string;
    id: number;
    status: string;
    resolution?: string | null;
  }) => {
    requireAuth(data.password);
    return withDb(async (q) => {
      await q`
        UPDATE disputes SET
          status = ${data.status},
          resolution = COALESCE(${data.resolution ?? null}, resolution),
          updated_at = NOW()
        WHERE id = ${data.id}`;
      return { updated: true };
    });
  },
);

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

/* ──────────────────────────────────────────────────────────────
 * Client: shared UI helpers
 * ────────────────────────────────────────────────────────────── */

type Tab = "overview" | "jobs" | "contractors" | "customers" | "payments" | "disputes";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "jobs", label: "Jobs", icon: "🔨" },
  { id: "contractors", label: "Contractors", icon: "👷" },
  { id: "customers", label: "Customers", icon: "🏠" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "disputes", label: "Disputes", icon: "⚖️" },
];

const REQUEST_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  assigned: "bg-indigo-100 text-indigo-700",
  scheduled: "bg-purple-100 text-purple-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  accepted: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  disputed: "bg-rose-100 text-rose-700",
};

const CONTRACTOR_STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  verified: "bg-cyan-100 text-cyan-700",
  approved: "bg-indigo-100 text-indigo-700",
  rejected: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  customer_payment: "bg-green-100 text-green-700",
  contractor_payout: "bg-indigo-100 text-indigo-700",
  refund: "bg-amber-100 text-amber-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  under_review: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-600",
};

function Badge({
  value,
  colors,
}: {
  value: string | null;
  colors: Record<string, string>;
}) {
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " +
        (value && colors[value] ? colors[value] : "bg-gray-100 text-gray-600")
      }
    >
      {value ? value.replace(/_/g, " ") : "—"}
    </span>
  );
}

function fmtMoney(v: number | null): string {
  if (v == null) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TitleCase(v: string | null): string {
  if (!v) return "—";
  return v
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"rounded-xl border border-gray-200 bg-white shadow-sm " + className}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function DbError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="font-semibold">Database unavailable.</span> Live data can&apos;t be
      loaded right now: <span className="font-mono text-xs">{message}</span>. This dashboard
      will work automatically once <span className="font-mono text-xs">DATABASE_URL</span> is
      connected.
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-gray-400">{label}</div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      <p className={"mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl " + accent}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className={
          "mt-4 w-full rounded-xl bg-white shadow-2xl " +
          (wide ? "max-w-3xl" : "max-w-xl")
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="mt-1 text-sm text-gray-900">{children}</div>
    </div>
  );
}

const selectCls =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";
const inputCls =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";
const btnPrimary =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60";
const btnGhost =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function useRefresh() {
  const [tick, setTick] = useState(0);
  return { tick, refresh: () => setTick((t) => t + 1) };
}

/* ──────────────────────────────────────────────────────────────
 * Client: page shell + login
 * ────────────────────────────────────────────────────────────── */

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  if (!authed) {
    return (
      <LoginForm
        onSuccess={(pw) => {
          setPassword(pw);
          setAuthed(true);
          setTab("overview");
        }}
      />
    );
  }

  return (
    <Dashboard
      password={password}
      tab={tab}
      setTab={setTab}
      onLogout={() => {
        setAuthed(false);
        setPassword("");
      }}
    />
  );
}

function LoginForm({ onSuccess }: { onSuccess: (password: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await adminLogin({ password: input });
      if (res && res.ok) onSuccess(input);
      else setError("Incorrect password. Access denied.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-blue-700 via-indigo-700 to-indigo-900">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-2xl">
            🛠️
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">ServiceHQ Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to manage requests, jobs, contractors, payments, and disputes.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">
                Admin password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !input}
              className="w-full rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            <a href="/" className="text-indigo-600 hover:underline">
              ← Back to ServiceHQ site
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  password,
  tab,
  setTab,
  onLogout,
}: {
  password: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-dvh bg-gray-100">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-base">
              🛠️
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">ServiceHQ Admin</p>
              <p className="text-[11px] leading-tight text-blue-200">Operations dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-white/10 hover:text-white"
            >
              View site ↗
            </a>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:flex-row md:items-start">
        {/* Nav: horizontal scroll on mobile, sidebar on md+ */}
        <nav className="shrink-0 md:sticky md:top-[68px] md:w-52">
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:pb-0">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition " +
                    (active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 shadow-sm hover:bg-blue-50 hover:text-blue-700")
                  }
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="min-w-0 flex-1 space-y-5">
          {tab === "overview" && <OverviewSection password={password} />}
          {tab === "jobs" && <JobsSection password={password} />}
          {tab === "contractors" && <ContractorsSection password={password} />}
          {tab === "customers" && <CustomersSection password={password} />}
          {tab === "payments" && <PaymentsSection password={password} />}
          {tab === "disputes" && <DisputesSection password={password} />}
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Sections
 * ────────────────────────────────────────────────────────────── */

type OverviewData = {
  stats: {
    total_requests: number;
    active_contractors: number;
    completed_jobs: number;
    revenue: number;
    open_disputes: number;
  };
  recent: {
    id: number;
    name: string | null;
    email: string | null;
    service_type: string | null;
    status: string | null;
    created_at: string | null;
  }[];
  breakdown: { status: string | null; count: number }[];
};

function OverviewSection({ password }: { password: string }) {
  const { tick } = useRefresh();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminOverview({ password }).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) {
        setData(res.data);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, tick]);

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Loading…</p>;
  if (error || !data)
    return (
      <Card>
        <div className="p-5">{error ? <DbError message={error} /> : <Empty label="No data." />}</div>
      </Card>
    );

  const { stats, recent, breakdown } = data;
  const totalBreakdown = breakdown.reduce((acc, b) => acc + b.count, 0) || 1;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total requests"
          value={String(stats.total_requests)}
          sub="All-time service requests"
          accent="text-gray-900"
        />
        <StatCard
          label="Active contractors"
          value={String(stats.active_contractors)}
          sub="Currently taking jobs"
          accent="text-blue-700"
        />
        <StatCard
          label="Completed jobs"
          value={String(stats.completed_jobs)}
          sub="Jobs marked complete"
          accent="text-indigo-700"
        />
        <StatCard
          label="Revenue"
          value={fmtMoney(stats.revenue)}
          sub="Collected customer payments"
          accent="text-green-600"
        />
        <StatCard
          label="Open disputes"
          value={String(stats.open_disputes)}
          sub="Open or under review"
          accent={stats.open_disputes > 0 ? "text-red-600" : "text-gray-900"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card
          title="Recent activity"
          subtitle="Latest service requests"
          className="lg:col-span-3"
          action={
            <button type="button" className={btnGhost} onClick={() => {}} disabled>
              Live feed
            </button>
          }
        >
          {recent.length === 0 ? (
            <Empty label="No service requests yet." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {r.name ?? "Unknown"} <span className="font-normal text-gray-400">· {TitleCase(r.service_type)}</span>
                    </p>
                    <p className="truncate text-xs text-gray-400">{fmtDate(r.created_at)}</p>
                  </div>
                  <Badge value={r.status} colors={REQUEST_STATUS_COLORS} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Status breakdown" subtitle="Service requests by status">
            {breakdown.length === 0 ? (
              <Empty label="No data yet." />
            ) : (
              <div className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  {breakdown.map((b) => (
                    <div
                      key={b.status ?? "null"}
                      title={`${TitleCase(b.status)}: ${b.count}`}
                      className={
                        "h-full " +
                        (REQUEST_STATUS_COLORS[b.status ?? ""]?.split(" ")[0] ??
                          "bg-gray-300")
                      }
                      style={{ width: `${(b.count / totalBreakdown) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {breakdown.map((b) => (
                    <li key={b.status ?? "null"} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        <span
                          className={
                            "h-2.5 w-2.5 rounded-full " +
                            (REQUEST_STATUS_COLORS[b.status ?? ""]?.split(" ")[0] ??
                              "bg-gray-300")
                          }
                        />
                        {TitleCase(b.status)}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">{b.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Platform" subtitle="Quick links">
            <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-5">
              <a href="/" className={btnGhost}>Landing page</a>
              <a href="/quote" className={btnGhost}>Quote calculator</a>
              <a href="/contractors" className={btnGhost}>Contractor page</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ── Jobs ── */

type JobRow = {
  id: number;
  status: string | null;
  scheduled_at: string | null;
  price_quoted: number | null;
  price_final: number | null;
  created_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  service_type: string | null;
  message: string | null;
  contractor_name: string | null;
  contractor_company: string | null;
};

type JobDetail = {
  job: {
    id: number;
    status: string | null;
    scheduled_at: string | null;
    completed_at: string | null;
    price_quoted: number | null;
    price_final: number | null;
    platform_fee_pct: number | null;
    created_at: string | null;
    contractor_id: number | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    customer_city: string | null;
    customer_county: string | null;
    contractor_name: string | null;
    contractor_company: string | null;
    contractor_email: string | null;
    requester_name: string | null;
    requester_email: string | null;
    requester_phone: string | null;
    service_type: string | null;
    message: string | null;
    request_status: string | null;
  };
  contractors: {
    id: number;
    name: string | null;
    company_name: string | null;
    service_type: string | null;
    status: string | null;
  }[];
  payments: {
    id: number;
    amount: number | null;
    type: string | null;
    status: string | null;
    stripe_id: string | null;
    created_at: string | null;
  }[];
};

const JOB_STATUSES = ["pending", "accepted", "in_progress", "completed", "cancelled", "disputed"];

function JobsSection({ password }: { password: string }) {
  const { tick, refresh } = useRefresh();
  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    adminJobs({ password, status: statusFilter || null }).then((res) => {
      if (!live) return;
      if (res.ok) {
        setRows(res.data);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, statusFilter, tick]);

  return (
    <Card
      title="Jobs"
      subtitle="All platform jobs — click a row for details"
      action={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectCls}
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TitleCase(s)}
            </option>
          ))}
        </select>
      }
    >
      {error && (
        <div className="px-5 pt-4">
          <DbError message={error} />
        </div>
      )}
      {rows === null && !error ? (
        <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <Empty label="No jobs match this filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs tracking-wide text-gray-500 uppercase">
                <th className="px-5 py-2.5 font-medium">ID</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Contractor</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Quoted</th>
                <th className="px-5 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows!.map((j) => (
                <tr
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
                  className="cursor-pointer transition hover:bg-blue-50/60"
                >
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">#{j.id}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{j.customer_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{TitleCase(j.service_type)}</td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {j.contractor_name ?? <span className="text-gray-300">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge value={j.status} colors={JOB_STATUS_COLORS} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-600">{fmtMoney(j.price_quoted)}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(j.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId != null && (
        <JobDetailModal
          password={password}
          jobId={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={() => {
            setSelectedId(null);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function JobDetailModal({
  password,
  jobId,
  onClose,
  onSaved,
}: {
  password: string;
  jobId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [status, setStatus] = useState("");
  const [contractorId, setContractorId] = useState<string>("");
  const [priceQuoted, setPriceQuoted] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminJobDetail({ password, id: jobId }).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok && res.data) {
        setDetail(res.data);
        setStatus(res.data.job.status ?? "");
        setContractorId(res.data.job.contractor_id != null ? String(res.data.job.contractor_id) : "");
        setPriceQuoted(res.data.job.price_quoted != null ? String(res.data.job.price_quoted) : "");
      } else if (res.ok) {
        setDetail(null);
      } else {
        setSaveError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, jobId]);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    const res = await adminUpdateJob({
      password,
      id: jobId,
      status,
      contractorId: contractorId ? Number(contractorId) : null,
      priceQuoted: priceQuoted ? Number(priceQuoted) : null,
    });
    setSaving(false);
    if (res.ok && res.data.updated) onSaved();
    else setSaveError(res.ok ? "No changes saved." : res.error);
  };

  const j = detail?.job;

  return (
    <Modal title={j ? `Job #${j.id} — ${TitleCase(j.status)}` : "Job details"} onClose={onClose} wide>
      {loading && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}
      {!loading && saveError && !j && <DbError message={saveError} />}
      {!loading && j && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Customer">
              <span className="font-medium text-gray-900">{j.customer_name}</span>
              <span className="block text-xs text-gray-500">{j.customer_email}</span>
              <span className="block text-xs text-gray-500">{j.customer_phone}</span>
            </Field>
            <Field label="Location">
              <span>{[j.customer_address, j.customer_city].filter(Boolean).join(", ") || "—"}</span>
              <span className="block text-xs text-gray-500">{j.customer_county}</span>
            </Field>
            <Field label="Service">
              <span className="font-medium">{TitleCase(j.service_type)}</span>
              <span className="block text-xs text-gray-500">Request status: {TitleCase(j.request_status)}</span>
            </Field>
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Request message</p>
            <p className="mt-1 text-sm text-gray-700">{j.message || "—"}</p>
            <p className="mt-2 text-xs text-gray-400">
              From {j.requester_name} · {j.requester_email} · {j.requester_phone}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Created">{fmtDate(j.created_at)}</Field>
            <Field label="Scheduled">{fmtDate(j.scheduled_at)}</Field>
            <Field label="Completed">{fmtDate(j.completed_at)}</Field>
            <Field label="Fee">{j.platform_fee_pct != null ? `${j.platform_fee_pct}%` : "—"}</Field>
          </div>

          {detail!.payments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Payments</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase">
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detail!.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-mono text-gray-500">#{p.id}</td>
                        <td className="px-3 py-2"><Badge value={p.type} colors={PAYMENT_TYPE_COLORS} /></td>
                        <td className="px-3 py-2 font-medium tabular-nums text-gray-900">{fmtMoney(p.amount)}</td>
                        <td className="px-3 py-2"><Badge value={p.status} colors={PAYMENT_STATUS_COLORS} /></td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <p className="mb-3 text-xs font-semibold text-indigo-800 uppercase tracking-wide">
              Update job
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={"mt-1 w-full " + selectCls}
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>{TitleCase(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Assign contractor</label>
                <select
                  value={contractorId}
                  onChange={(e) => setContractorId(e.target.value)}
                  className={"mt-1 w-full " + selectCls}
                >
                  <option value="">Unassigned</option>
                  {detail!.contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.company_name} ({TitleCase(c.service_type)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Price quoted ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceQuoted}
                  onChange={(e) => setPriceQuoted(e.target.value)}
                  className={"mt-1 w-full " + inputCls}
                  placeholder="0.00"
                />
              </div>
            </div>
            {saveError && (
              <p className="mt-2 text-xs text-red-600">
                {saveError.startsWith("Database") ? "Database unavailable — check DATABASE_URL." : saveError}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onClose} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving || !status} className={btnPrimary}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Contractors ── */

type ContractorRow = {
  id: number;
  name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  service_type: string | null;
  years_experience: number | null;
  license_number: string | null;
  insurance_info: string | null;
  status: string | null;
  service_radius_miles: number | null;
  tn_counties: string[];
  created_at: string | null;
};

const CONTRACTOR_STATUSES = ["applied", "verified", "approved", "rejected", "active", "inactive"];

function ContractorsSection({ password }: { password: string }) {
  const { tick, refresh } = useRefresh();
  const [rows, setRows] = useState<ContractorRow[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    adminContractors({ password, status: statusFilter || null }).then((res) => {
      if (!live) return;
      if (res.ok) {
        setRows(res.data);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, statusFilter, tick]);

  const setStatus = async (id: number, status: string) => {
    const res = await adminUpdateContractor({ password, id, status });
    if (res.ok) refresh();
  };

  return (
    <Card
      title="Contractors"
      subtitle="Applications and active pros — actions apply immediately"
      action={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectCls}
        >
          <option value="">All statuses</option>
          {CONTRACTOR_STATUSES.map((s) => (
            <option key={s} value={s}>{TitleCase(s)}</option>
          ))}
        </select>
      }
    >
      {error && (
        <div className="px-5 pt-4">
          <DbError message={error} />
        </div>
      )}
      {rows === null && !error ? (
        <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <Empty label="No contractors match this filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs tracking-wide text-gray-500 uppercase">
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Experience</th>
                <th className="px-3 py-2.5 font-medium">Radius</th>
                <th className="px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows!.map((c) => (
                <tr key={c.id} className="transition hover:bg-blue-50/60">
                  <td className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {c.name ?? "—"}
                    </button>
                    <span className="block text-xs text-gray-400">{c.email}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{c.company_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{TitleCase(c.service_type)}</td>
                  <td className="px-3 py-2.5">
                    <Badge value={c.status} colors={CONTRACTOR_STATUS_COLORS} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {c.years_experience != null ? `${c.years_experience} yrs` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {c.service_radius_miles != null ? `${c.service_radius_miles} mi` : "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Profile
                      </button>
                      {c.status !== "approved" && c.status !== "active" && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "approved")}
                          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Approve
                        </button>
                      )}
                      {c.status !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "rejected")}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      )}
                      {c.status !== "active" && c.status !== "applied" && c.status !== "verified" && c.status !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "active")}
                          className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          Activate
                        </button>
                      )}
                      {c.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "inactive")}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId != null && (
        <ContractorProfileModal
          password={password}
          contractorId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Card>
  );
}

function ContractorProfileModal({
  password,
  contractorId,
  onClose,
}: {
  password: string;
  contractorId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    contractor: ContractorRow;
    counts: { total_jobs: number; completed_jobs: number };
    recent_jobs: { id: number; status: string | null; price_final: number | null; created_at: string | null; customer_name: string | null }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminContractorDetail({ password, id: contractorId }).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data);
        setError("");
      } else if (res.ok) {
        setData(null);
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, contractorId]);

  const c = data?.contractor;

  return (
    <Modal
      title={c ? `${c.name} — ${c.company_name}` : "Contractor profile"}
      onClose={onClose}
      wide
    >
      {loading && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}
      {!loading && error && <DbError message={error} />}
      {!loading && !error && !c && <Empty label="Contractor not found." />}
      {!loading && c && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-gray-900">{c.name}</p>
              <p className="text-sm text-gray-500">{c.company_name}</p>
            </div>
            <Badge value={c.status} colors={CONTRACTOR_STATUS_COLORS} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Email">{c.email ?? "—"}</Field>
            <Field label="Phone">{c.phone ?? "—"}</Field>
            <Field label="Service">{TitleCase(c.service_type)}</Field>
            <Field label="Experience">
              {c.years_experience != null ? `${c.years_experience} years` : "—"}
            </Field>
            <Field label="License">{c.license_number ?? "—"}</Field>
            <Field label="Radius">{c.service_radius_miles != null ? `${c.service_radius_miles} miles` : "—"}</Field>
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Insurance</p>
            <p className="mt-1 text-sm text-gray-700">{c.insurance_info || "—"}</p>
            <p className="mt-2 text-xs font-medium text-gray-500 uppercase tracking-wide">TN counties served</p>
            <p className="mt-1 text-sm text-gray-700">
              {c.tn_counties.length > 0 ? c.tn_counties.join(", ") : "—"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">{data!.counts.total_jobs}</p>
              <p className="text-xs text-gray-500">Total jobs</p>
            </div>
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-center">
              <p className="text-lg font-bold text-green-600 tabular-nums">{data!.counts.completed_jobs}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-center">
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {data!.counts.total_jobs > 0
                  ? Math.round((data!.counts.completed_jobs / data!.counts.total_jobs) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-gray-500">Completion</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Recent jobs
            </p>
            {data!.recent_jobs.length === 0 ? (
              <p className="text-sm text-gray-400">No jobs yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[400px] text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase">
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Final</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data!.recent_jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="px-3 py-2 font-mono text-gray-500">#{j.id}</td>
                        <td className="px-3 py-2 text-gray-700">{j.customer_name ?? "—"}</td>
                        <td className="px-3 py-2"><Badge value={j.status} colors={JOB_STATUS_COLORS} /></td>
                        <td className="px-3 py-2 font-medium tabular-nums text-gray-900">{fmtMoney(j.price_final)}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">Applied {fmtDate(c.created_at)}.</p>
        </div>
      )}
    </Modal>
  );
}

/* ── Customers ── */

type CustomerRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tn_county: string | null;
  created_at: string | null;
  request_count: number;
  job_count: number;
};

function CustomersSection({ password }: { password: string }) {
  const { tick } = useRefresh();
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    adminCustomers({ password, search: search || null }).then((res) => {
      if (!live) return;
      if (res.ok) {
        setRows(res.data);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, search, tick]);

  return (
    <Card
      title="Customers"
      subtitle="Homeowners on the platform"
      action={
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, city…"
          className={"w-56 " + inputCls}
        />
      }
    >
      {error && (
        <div className="px-5 pt-4">
          <DbError message={error} />
        </div>
      )}
      {rows === null && !error ? (
        <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <Empty label={search ? "No customers match your search." : "No customers yet."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs tracking-wide text-gray-500 uppercase">
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">City / County</th>
                <th className="px-3 py-2.5 font-medium">Requests</th>
                <th className="px-3 py-2.5 font-medium">Jobs</th>
                <th className="px-5 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows!.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="cursor-pointer transition hover:bg-blue-50/60"
                >
                  <td className="px-5 py-2.5 font-medium text-gray-900">{c.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {[c.city, c.tn_county].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-600">{c.request_count}</td>
                  <td className="px-3 py-2.5 tabular-nums text-gray-600">{c.job_count}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId != null && (
        <CustomerDetailModal
          password={password}
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Card>
  );
}

function CustomerDetailModal({
  password,
  customerId,
  onClose,
}: {
  password: string;
  customerId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    customer: {
      id: number;
      name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      tn_county: string | null;
      created_at: string | null;
    };
    requests: { id: number; service_type: string | null; status: string | null; message: string | null; created_at: string | null }[];
    jobs: { id: number; status: string | null; price_final: number | null; created_at: string | null; service_type: string | null; contractor_name: string | null }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminCustomerDetail({ password, id: customerId }).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data);
        setError("");
      } else if (res.ok) {
        setData(null);
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, customerId]);

  const c = data?.customer;

  return (
    <Modal title={c ? `Customer: ${c.name}` : "Customer"} onClose={onClose} wide>
      {loading && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}
      {!loading && error && <DbError message={error} />}
      {!loading && !error && !c && <Empty label="Customer not found." />}
      {!loading && c && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Name"><span className="font-medium text-gray-900">{c.name}</span></Field>
            <Field label="Email">{c.email ?? "—"}</Field>
            <Field label="Phone">{c.phone ?? "—"}</Field>
            <Field label="Address">{c.address ?? "—"}</Field>
            <Field label="City">{c.city ?? "—"}</Field>
            <Field label="County">{c.tn_county ?? "—"}</Field>
          </div>
          <p className="text-xs text-gray-400">Customer since {fmtDate(c.created_at)}.</p>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Service requests ({data!.requests.length})
            </p>
            {data!.requests.length === 0 ? (
              <p className="text-sm text-gray-400">No requests.</p>
            ) : (
              <div className="space-y-2">
                {data!.requests.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {TitleCase(r.service_type)} <span className="font-mono text-xs text-gray-400">#{r.id}</span>
                      </p>
                      <p className="truncate text-xs text-gray-500">{r.message}</p>
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <Badge value={r.status} colors={REQUEST_STATUS_COLORS} />
                      <p className="text-[11px] text-gray-400">{fmtDate(r.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Jobs ({data!.jobs.length})
            </p>
            {data!.jobs.length === 0 ? (
              <p className="text-sm text-gray-400">No jobs.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase">
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium">Contractor</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Final</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data!.jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="px-3 py-2 font-mono text-gray-500">#{j.id}</td>
                        <td className="px-3 py-2 text-gray-700">{TitleCase(j.service_type)}</td>
                        <td className="px-3 py-2 text-gray-700">{j.contractor_name ?? "—"}</td>
                        <td className="px-3 py-2"><Badge value={j.status} colors={JOB_STATUS_COLORS} /></td>
                        <td className="px-3 py-2 font-medium tabular-nums text-gray-900">{fmtMoney(j.price_final)}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Payments ── */

type PaymentRow = {
  id: number;
  amount: number | null;
  type: string | null;
  status: string | null;
  stripe_id: string | null;
  created_at: string | null;
  job_id: number;
  customer_name: string | null;
  contractor_name: string | null;
};

const PAYMENT_TYPES = ["customer_payment", "contractor_payout", "refund"];
const PAYMENT_STATUSES = ["pending", "completed", "failed"];

function PaymentsSection({ password }: { password: string }) {
  const { tick } = useRefresh();
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    total_amount: number;
    completed: number;
    completed_amount: number;
    pending: number;
    pending_amount: number;
    customer_payments: number;
    payouts: number;
    refunds: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let live = true;
    setRows(null);
    adminPayments({ password, type: typeFilter || null, status: statusFilter || null }).then(
      (res) => {
        if (!live) return;
        if (res.ok) {
          setRows(res.data.payments);
          setSummary(res.data.summary);
          setError("");
        } else {
          setError(res.error);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [password, typeFilter, statusFilter, tick]);

  return (
    <>
      {error ? (
        <Card>
          <div className="p-5">
            <DbError message={error} />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="All time" value={fmtMoney(summary?.total_amount ?? 0)} sub={`${summary?.total ?? 0} transactions`} accent="text-gray-900" />
            <StatCard label="Collected" value={fmtMoney(summary?.completed_amount ?? 0)} sub={`${summary?.completed ?? 0} completed`} accent="text-green-600" />
            <StatCard label="Pending" value={fmtMoney(summary?.pending_amount ?? 0)} sub={`${summary?.pending ?? 0} pending`} accent="text-amber-600" />
            <StatCard label="Customer payments" value={String(summary?.customer_payments ?? 0)} sub="Count" accent="text-blue-700" />
            <StatCard label="Contractor payouts" value={String(summary?.payouts ?? 0)} sub="Count" accent="text-indigo-700" />
            <StatCard label="Refunds" value={String(summary?.refunds ?? 0)} sub="Count" accent="text-gray-700" />
          </div>

          <Card
            title="Payments"
            subtitle="Customer payments, contractor payouts, refunds"
            action={
              <div className="flex gap-2">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
                  <option value="">All types</option>
                  {PAYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{TitleCase(t)}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
                  <option value="">All statuses</option>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{TitleCase(s)}</option>
                  ))}
                </select>
              </div>
            }
          >
            {rows === null ? (
              <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
            ) : rows.length === 0 ? (
              <Empty label="No payments match these filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs tracking-wide text-gray-500 uppercase">
                      <th className="px-5 py-2.5 font-medium">ID</th>
                      <th className="px-3 py-2.5 font-medium">Job</th>
                      <th className="px-3 py-2.5 font-medium">Customer</th>
                      <th className="px-3 py-2.5 font-medium">Contractor</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Amount</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((p) => (
                      <tr key={p.id} className="transition hover:bg-blue-50/60">
                        <td className="px-5 py-2.5 font-mono text-xs text-gray-500">#{p.id}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">#{p.job_id}</td>
                        <td className="px-3 py-2.5 text-gray-900">{p.customer_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.contractor_name ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <Badge value={p.type} colors={PAYMENT_TYPE_COLORS} />
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-gray-900">{fmtMoney(p.amount)}</td>
                        <td className="px-3 py-2.5">
                          <Badge value={p.status} colors={PAYMENT_STATUS_COLORS} />
                        </td>
                        <td className="px-5 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

/* ── Disputes ── */

type DisputeRow = {
  id: number;
  job_id: number;
  raised_by: string | null;
  reason: string | null;
  status: string | null;
  resolution: string | null;
  created_at: string | null;
  updated_at: string | null;
  customer_name: string | null;
  contractor_name: string | null;
};

const DISPUTE_STATUSES = ["open", "under_review", "resolved", "closed"];

function DisputesSection({ password }: { password: string }) {
  const { tick, refresh } = useRefresh();
  const [rows, setRows] = useState<DisputeRow[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [statusDraft, setStatusDraft] = useState("under_review");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let live = true;
    setRows(null);
    adminDisputes({ password }).then((res) => {
      if (!live) return;
      if (res.ok) {
        setRows(res.data);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [password, tick]);

  const open = (d: DisputeRow) => {
    setOpenId(d.id);
    setStatusDraft(d.status ?? "open");
    setResolutionDraft(d.resolution ?? "");
    setSaveError("");
  };

  const save = async () => {
    if (openId == null) return;
    setSaving(true);
    setSaveError("");
    const res = await adminUpdateDispute({
      password,
      id: openId,
      status: statusDraft,
      resolution: resolutionDraft.trim() || null,
    });
    setSaving(false);
    if (res.ok && res.data.updated) {
      setOpenId(null);
      refresh();
    } else {
      setSaveError(res.ok ? "No changes saved." : res.error);
    }
  };

  return (
    <Card title="Disputes" subtitle="Job disputes raised by customers or contractors">
      {error && (
        <div className="px-5 pt-4">
          <DbError message={error} />
        </div>
      )}
      {rows === null && !error ? (
        <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <Empty label="No disputes. Keep it that way! 🎉" />
      ) : (
        <div className="divide-y divide-gray-50">
          {rows!.map((d) => (
            <div key={d.id}>
              <button
                type="button"
                onClick={() => (openId === d.id ? setOpenId(null) : open(d))}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-blue-50/60 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Dispute #{d.id}
                    <span className="ml-2 font-mono text-xs text-gray-400">job #{d.job_id}</span>
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    Raised by {TitleCase(d.raised_by)} · {d.customer_name ?? "?"}
                    {d.contractor_name ? ` vs ${d.contractor_name}` : ""} · {fmtDate(d.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge value={d.status} colors={DISPUTE_STATUS_COLORS} />
                  <span className="text-xs text-gray-400">{openId === d.id ? "▾" : "▸"}</span>
                </div>
              </button>

              {openId === d.id && (
                <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:px-5">
                  <div className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</p>
                    <p className="mt-1 text-sm text-gray-800">{d.reason ?? "—"}</p>
                    {d.resolution && (
                      <>
                        <p className="mt-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Current resolution
                        </p>
                        <p className="mt-1 text-sm text-gray-800">{d.resolution}</p>
                      </>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Status</label>
                      <select
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        className={"mt-1 w-full " + selectCls}
                      >
                        {DISPUTE_STATUSES.map((s) => (
                          <option key={s} value={s}>{TitleCase(s)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Resolution note</label>
                      <textarea
                        value={resolutionDraft}
                        onChange={(e) => setResolutionDraft(e.target.value)}
                        rows={2}
                        className={"mt-1 w-full " + inputCls}
                        placeholder="Describe the outcome…"
                      />
                    </div>
                  </div>
                  {saveError && (
                    <p className="mt-2 text-xs text-red-600">
                      {saveError.startsWith("Database") ? "Database unavailable — check DATABASE_URL." : saveError}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setOpenId(null)} className={btnGhost}>
                      Cancel
                    </button>
                    <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
                      {saving ? "Saving…" : "Update dispute"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
